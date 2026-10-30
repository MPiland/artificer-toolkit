import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput,
  type LiveSessionEncounterRulesRequest
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import {
  liveSessionEncounterConcentrationCommitInputSchema,
  liveSessionEncounterConcentrationWindowInputSchema,
  type LiveSessionEncounterConcentrationCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterConcentration'
import { damageSaveWindowResume } from '@artificer-toolkit/rules-runtime/encounterD20Window'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import { planNativeLiveConcentration } from './nativeEncounterConcentration.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'
import { rebuildNativeLiveDeferredCleaving } from './nativeEncounterCleaving.js'
import type { LiveCaptureReads } from './nativeEncounterReads.js'

/** Plans one admitted concentration response without publishing the child or touching the Run. */
export async function planNativeLiveConcentrationResponse(
  scope: Omit<LiveSessionEncounterRulesInput, 'request' | 'concentrationResponse'>,
  response: ResolveRuleOccurrenceInputDto,
  executionOptions: {
    runtime: RulesRuntimeService
    random(maximum: number): number
    captures: LiveCaptureReads
  }
) {
  const initial = liveSessionEncounterRulesInputSchema.parse({
    ...scope,
    concentrationResponse: response,
    request: { kind: 'CONCENTRATION_RESPONSE' }
  })
  if (
    response.encounterId.toLowerCase() !== initial.encounterId ||
    response.expectedVersion !== initial.expectedVersion
  )
    throw new Error('Live concentration response scope mismatch.')
  const dependencies: Array<{ request: LiveSessionEncounterRulesRequest }> = []
  let revisions: LiveSessionEncounterConcentrationCommitInput['revisions'] = []
  async function capture(request: LiveSessionEncounterRulesRequest) {
    const input = liveSessionEncounterRulesInputSchema.parse({ ...initial, request })
    const result = await executionOptions.captures.encounterRules(input)
    if (result.kind !== request.kind) throw new Error('Concentration capture kind mismatch.')
    revisions = mergeNativeRulesRevisions(revisions, result.revisions)
    dependencies.push({ request: input.request })
    return result
  }
  const admission = await capture({ kind: 'CONCENTRATION_RESPONSE' })
  if (admission.kind !== 'CONCENTRATION_RESPONSE')
    throw new Error('Concentration response is unavailable.')
  if (admission.result) return { kind: 'REPLAY' as const, result: admission.result }
  const { state, parentApplications } = admission
  // The save as it paused, and the d20 window that follows its roll when that is what pends (D168).
  const resumed = admission.snapshot ? damageSaveWindowResume(admission.snapshot) : null
  const snapshot = resumed?.save ?? admission.snapshot
  if (
    !snapshot ||
    snapshot.applicationContext.kind !== 'ENCOUNTER_DAMAGE_SAVE_CHECK' ||
    state.id !== initial.encounterId ||
    state.version !== initial.expectedVersion ||
    checksumRuleDocument(parentApplications) !==
      snapshot.applicationContext.finalizedDamageEnvelopeChecksum
  )
    throw new Error('Concentration response binding mismatch.')
  const inputs = await capture({ kind: 'INPUTS' })
  if (
    inputs.kind !== 'INPUTS' ||
    checksumRuleDocument(inputs.state) !== checksumRuleDocument(state)
  )
    throw new Error('Concentration Run inputs changed during capture.')
  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })
  const context = snapshot.applicationContext
  const applicationIndex = parentApplications.findIndex(
    (application) => checksumRuleDocument(application) === checksumRuleDocument(context.application)
  )
  if (applicationIndex < 0) throw new Error('Concentration parent application is unavailable.')
  const projectedTargets = new Map<
    string,
    Awaited<ReturnType<typeof prepareNativeLiveMovementTarget>>['target']
  >()
  async function loadTarget(actor: (typeof actors)[number]) {
    const existing = projectedTargets.get(actor.id)
    if (existing) return existing
    const prepared = await prepareNativeLiveMovementTarget({
      scope: initial,
      state,
      actor,
      activeEffectsByActorId,
      ...executionOptions
    })
    revisions = mergeNativeRulesRevisions(revisions, prepared.revisions)
    projectedTargets.set(actor.id, prepared.target)
    return prepared.target
  }
  const currentActorIds = new Set(
    parentApplications.slice(applicationIndex).map((application) => application.targetActorId)
  )
  await Promise.all(
    actors
      .filter((actor) => currentActorIds.has(actor.id))
      .map(async (actor) => {
        projectedTargets.set(actor.id, await loadTarget(actor))
      })
  )
  const occurredAt = new Date().toISOString()
  const startingProjection = {
    actors,
    projectedTargets,
    activeEffectsByActorId,
    maintenanceOwners: []
  }
  if (snapshot.deferredCleaving) {
    const deferred = await rebuildNativeLiveDeferredCleaving({
      state,
      context: snapshot.deferredCleaving,
      system: inputs.system,
      occurredAt,
      initialActors: actors,
      projection: startingProjection,
      loadTarget,
      capture
    })
    if (
      !deferred ||
      checksumRuleDocument(deferred.applicationContext) !==
        checksumRuleDocument(snapshot.deferredCleaving)
    )
      throw new Error('The deferred Cleaving choice is stale.')
  }
  const planned = await planNativeLiveConcentration({
    state,
    // Remaining checks auto-roll by their roller's preference until one prompts (D23).
    autoRollByActorId: admission.autoRollByActorId,
    parentOccurrenceId: context.parentOccurrenceId,
    parentCommandFingerprint: context.parentCommandFingerprint,
    applications: parentApplications,
    sourceLabels: context.sourceLabels,
    occurredAt,
    settlement: { ...startingProjection, maintainedState: null, createdEffects: [] },
    capture,
    runtime: executionOptions.runtime,
    random: executionOptions.random,
    resume: {
      snapshot,
      context,
      response,
      appRoll: admission.appRoll,
      applicationIndex,
      ...(resumed
        ? { window: { context: resumed.window.context, continuation: resumed.window.continuation } }
        : {})
    }
  })
  // The roll opened a window: the same occurrence pends on it and nothing else settles.
  if (planned.window)
    return {
      kind: 'D20_WINDOW_PAUSE' as const,
      input: liveSessionEncounterConcentrationWindowInputSchema.parse({
        ...scope,
        concentrationResponse: response,
        revisions,
        occurredAt,
        snapshot: snapshot.deferredCleaving
          ? serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
              ...planned.window,
              deferredCleaving: snapshot.deferredCleaving
            })
          : planned.window
      })
    }
  if (!planned.resumed) throw new Error('Concentration response did not complete.')
  const nextFacts =
    planned.nextState.version !== state.version
      ? buildEncounterActorRuleFacts({ actors: planned.actors })
      : null
  const rules = nextFacts
    ? reconcileEncounterActorRuleOutput(
        evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts: nextFacts }),
        nextFacts
      )
    : null
  const pending =
    planned.pending && snapshot.deferredCleaving
      ? serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
          ...planned.pending,
          deferredCleaving: snapshot.deferredCleaving
        })
      : planned.pending
  const cleaving =
    !pending && snapshot.deferredCleaving
      ? await rebuildNativeLiveDeferredCleaving({
          state: planned.nextState,
          context: snapshot.deferredCleaving,
          system: inputs.system,
          occurredAt,
          initialActors: actors,
          projection: planned,
          loadTarget,
          capture
        })
      : null
  const maintenanceOwners = new Map(
    dependencies.flatMap(({ request }) =>
      request.kind === 'MAINTENANCE_OWNER'
        ? [[checksumRuleDocument(request), request] as const]
        : []
    )
  )
  const input = liveSessionEncounterConcentrationCommitInputSchema.parse({
    ...scope,
    concentrationResponse: response,
    revisions,
    occurredAt,
    execution: planned.resumed.result,
    rules,
    maintenanceOwners: [...maintenanceOwners.values()],
    concentration: planned.completed,
    pendingConcentration: pending,
    concentrationEnds: planned.concentrationEnds,
    endedGrants: planned.endedGrants,
    cleaving
  })
  return { kind: 'PLANNED' as const, input }
}
