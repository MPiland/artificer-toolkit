import {
  liveSessionEncounterRulesInputSchema,
  liveSessionEncounterRulesResponseSchema,
  type LiveSessionEncounterRulesInput,
  type LiveSessionEncounterRulesRequest
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import {
  liveSessionEncounterConcentrationCommitInputSchema,
  type LiveSessionEncounterConcentrationCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterConcentration'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
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
import { requestNativeLiveSession, type NativeLiveSessionEnvironment } from './nativeSceneClient.js'

/** Plans one admitted concentration response without publishing the child or touching the Run. */
export async function planNativeLiveConcentrationResponse(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  scope: Omit<LiveSessionEncounterRulesInput, 'request' | 'concentrationResponse'>,
  response: ResolveRuleOccurrenceInputDto,
  executionOptions: { runtime: RulesRuntimeService; random?: (maximum: number) => number }
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
  const dependencies: Array<{ request: LiveSessionEncounterRulesRequest; readChecksum: string }> =
    []
  let revisions: LiveSessionEncounterConcentrationCommitInput['revisions'] = []
  async function capture(request: LiveSessionEncounterRulesRequest) {
    const input = liveSessionEncounterRulesInputSchema.parse({ ...initial, request })
    const result = await requestNativeLiveSession(
      environment,
      accessToken,
      '/live-sessions/encounter-rules',
      input,
      (body) => liveSessionEncounterRulesResponseSchema.parse(body)
    )
    if (result.kind !== request.kind) throw new Error('Concentration capture kind mismatch.')
    revisions = mergeNativeRulesRevisions(revisions, result.revisions)
    dependencies.push({ request: input.request, readChecksum: result.readChecksum })
    return result
  }
  const admission = await capture({ kind: 'CONCENTRATION_RESPONSE' })
  if (admission.kind !== 'CONCENTRATION_RESPONSE')
    throw new Error('Concentration response is unavailable.')
  if (admission.result) return { kind: 'REPLAY' as const, result: admission.result }
  const { state, snapshot, parentApplications } = admission
  if (
    !snapshot ||
    snapshot.applicationContext.kind !== 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK' ||
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
      environment,
      accessToken,
      scope: initial,
      state,
      actor,
      activeEffectsByActorId
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
    parentOccurrenceId: context.parentOccurrenceId,
    parentCommandFingerprint: context.parentCommandFingerprint,
    applications: parentApplications,
    occurredAt,
    settlement: { ...startingProjection, maintainedState: null, createdEffects: [] },
    capture,
    runtime: executionOptions.runtime,
    random: executionOptions.random,
    resume: { snapshot, context, response, applicationIndex }
  })
  if (!planned.resumed) throw new Error('Concentration response did not complete.')
  const nextFacts = planned.resumed.failed
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
    pending,
    cleaving
  })
  return { kind: 'PLANNED' as const, input }
}

export async function commitNativeLiveConcentrationResponse(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  plan: Extract<
    Awaited<ReturnType<typeof planNativeLiveConcentrationResponse>>,
    { kind: 'PLANNED' }
  >
) {
  return requestNativeLiveSession(
    environment,
    accessToken,
    '/live-sessions/encounter-concentration',
    plan.input,
    (body) => encounterCommandResultDtoSchema.parse(body)
  )
}
