import {
  readBasicActionCheckSnapshot,
  readCheckActionSnapshot
} from '@artificer-toolkit/encounter-persistence/basicActionCheckPending'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  liveSessionEncounterBasicActionResponseCommitInputSchema,
  liveSessionEncounterCheckPauseCommitInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { resolveEncounterActionSource } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { readEncounterBasicActionEntries } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { planNativeLiveCheckActionResponse } from './nativeCheckActionResponse.js'
import { settleNativeConcealmentCheck } from './nativeConcealmentCheck.js'
import { answerNativeD20Check } from './nativeD20Window.js'
import { liveEncounterCaptures, type LiveCaptureReads } from './nativeEncounterReads.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects,
  readNativeLiveSpellPins
} from './nativeEncounterTargets.js'

/**
 * Plans the roller's answer to a pending check in the room: a check action's d20 or outcome dice
 * (D173), or a concealment check's d20 (Hide, Search), decided per observer from its total. A d20
 * whose roller holds after-roll dice opens a d20 window first, and its answer settles the check
 * (D168). Convex re-applies the change and records the result; it never rolls.
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
  const { state, system } = await capture({ kind: 'INPUTS' })
  if (state.id !== initial.encounterId || state.version !== initial.expectedVersion)
    throw new Error('Basic action check Run inputs changed during capture.')
  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })
  const checkAction = readCheckActionSnapshot(ready.snapshot)
  if (checkAction)
    return planNativeLiveCheckActionResponse({
      scope,
      initial,
      reads,
      ready,
      command: ready.command,
      pending: checkAction,
      state,
      system,
      actors,
      activeEffectsByActorId,
      executionOptions
    })
  const { context, continuation, snapshot, window } = readBasicActionCheckSnapshot(ready.snapshot)
  const roller = actors.find((entry) => entry.id === context.actorId)
  if (!roller) throw new Error('Basic action check actors are unavailable.')
  const answered = await answerNativeD20Check({
    ...executionOptions,
    gameSystemId: state.gameSystemId,
    system,
    command: ready.command,
    appRoll: ready.appRoll,
    source: { kind: 'CONCEALMENT_CHECK', context },
    pending: { snapshot, continuation, window },
    rollerEffects: activeEffectsByActorId.get(roller.id) ?? [],
    optionalCombatSnapshotChecksum: snapshot.optionalCombatSnapshotChecksum ?? null,
    refusal: 'A concealment check requires d20 evidence.'
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
  const settlement = settleNativeConcealmentCheck({
    context,
    continuation,
    rolled: answered.rolled,
    appRollId: answered.appRollId,
    window: answered.window,
    state,
    actors,
    activeEffectsByActorId,
    capability: source.capability,
    occurredAt,
    occurrenceVersion: answered.occurrenceVersion
  })
  return {
    kind: 'PLANNED' as const,
    input: liveSessionEncounterBasicActionResponseCommitInputSchema.parse({
      ...scope,
      command: ready.command,
      revisions: reads.revisions(),
      occurredAt,
      settlement,
      rules
    })
  }
}
