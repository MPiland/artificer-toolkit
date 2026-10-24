import { readEscapeCheckSnapshot } from '@artificer-toolkit/encounter-persistence/basicActionCheckPending'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  liveSessionEncounterCheckPauseCommitInputSchema,
  liveSessionEncounterEscapeResponseCommitInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { evaluateRolledEncounterBasicActionCheck } from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  completeEncounterEscapeCheckResult,
  encounterActorsAfterEscape,
  encounterEscapeEndedConditionIds
} from '@artificer-toolkit/rules-runtime/encounterEscapeCheck'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { answerNativeD20Check } from './nativeD20Window.js'
import { liveEncounterCaptures, type LiveCaptureReads } from './nativeEncounterReads.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'

/**
 * Plans the holder's d20 for a pending Escape check in the room: the die settles the frozen check,
 * and a roll that reaches the DC frees the holder if the relationship still holds them. A d20 whose
 * roller holds after-roll dice opens a d20 window first, and its answer settles the check (D168). Convex
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
  const { context, continuation, snapshot, window } = readEscapeCheckSnapshot(ready.snapshot)
  const { state, system } = await capture({ kind: 'INPUTS' })
  if (state.id !== initial.encounterId || state.version !== initial.expectedVersion)
    throw new Error('Escape check Run inputs changed during capture.')
  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })
  const answered = await answerNativeD20Check({
    ...executionOptions,
    gameSystemId: state.gameSystemId,
    system,
    command: ready.command,
    appRoll: ready.appRoll,
    source: { kind: 'ESCAPE_CHECK', context },
    pending: { snapshot, continuation, window },
    rollerEffects: activeEffectsByActorId.get(context.actorId) ?? [],
    optionalCombatSnapshotChecksum: snapshot.optionalCombatSnapshotChecksum ?? null,
    refusal: 'An escape check requires d20 evidence.'
  })
  const occurredAt = new Date().toISOString()
  const facts = buildEncounterActorRuleFacts({ actors })
  const rules = reconcileEncounterActorRuleOutput(
    evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
    facts
  )
  if (answered.kind === 'WINDOW')
    return {
      kind: 'D20_WINDOW_PAUSE' as const,
      input: liveSessionEncounterCheckPauseCommitInputSchema.parse({
        ...scope,
        command: ready.command,
        revisions: reads.revisions(),
        occurredAt,
        snapshot: answered.snapshot,
        rules
      })
    }
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
  const evaluated = evaluateRolledEncounterBasicActionCheck(answered.rolled, context.check.dc)
  const { result } = completeEncounterEscapeCheckResult({
    context,
    continuation,
    evaluated,
    effectStillHeld,
    removedConditionIds: effectStillHeld
      ? encounterEscapeEndedConditionIds(heldEffects, context.activeEffectId)
      : [],
    occurrenceVersion: answered.occurrenceVersion,
    initialFactsChecksum: answered.rolled.initialFactsChecksum
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
  const nextFacts = buildEncounterActorRuleFacts({ actors: nextActors })
  return {
    kind: 'PLANNED' as const,
    input: liveSessionEncounterEscapeResponseCommitInputSchema.parse({
      ...scope,
      command: ready.command,
      revisions: reads.revisions(),
      occurredAt,
      settlement: {
        context,
        execution: result,
        appRollId: answered.appRollId,
        ...(answered.window && { window: answered.window })
      },
      rules: reconcileEncounterActorRuleOutput(
        evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts: nextFacts }),
        nextFacts,
        { output: rules }
      )
    })
  }
}
