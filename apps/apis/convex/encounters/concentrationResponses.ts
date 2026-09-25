import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { MutationCtx } from '../_generated/server'
import { projectNativeGm } from './nativeProjection'
import { createNativeConcentrationContext } from '@artificer-toolkit/rules-runtime/encounterConcentration'
import { loadNativeConcentrationState } from './concentrationState'
import {
  executeNativeConcentrationCheck,
  persistNativeConcentrationChain,
  planNativeConcentrationChain
} from './concentration'
import {
  insertNativeCleavingChoice,
  persistNativeConcentrationResult
} from './actionChildPersistence'
import { readEncounterAutoRollByActorId } from './actorController'
import { readNativeConcentrationResponseAdmission } from './concentrationResponseAdmission'
import { insertRunCommand } from './timelineEntries'
import { rebuildNativeDeferredCleaving } from './cleaving'
import { presentEncounterResultForMember } from './resultPresentation'

export async function resumeNativeConcentration(
  ctx: MutationCtx,
  response: ResolveRuleOccurrenceInputDto,
  userId: string
): Promise<EncounterCommandResultDto> {
  const admission = await readNativeConcentrationResponseAdmission(ctx, response, userId)
  if (!admission) throw new Error('The concentration occurrence is unavailable.')
  if (admission.kind === 'REPLAY') return admission.result
  const {
    state,
    run,
    campaign,
    membership,
    actors,
    projection,
    fingerprint,
    occurrence,
    pending,
    parentApplications,
    applicationIndex,
    resolution
  } = admission
  const { context, continuation, snapshot } = pending
  const targets = new Map<
    string,
    NonNullable<Awaited<ReturnType<typeof loadNativeConcentrationState>>>
  >()
  for (const targetActorId of new Set(
    parentApplications.slice(applicationIndex).map((application) => application.targetActorId)
  )) {
    const current = await loadNativeConcentrationState(ctx, {
      state,
      readVersion: state.version,
      targetActorId,
      userId
    })
    if (current) targets.set(targetActorId, current)
  }
  const remaining = parentApplications.slice(applicationIndex + 1).flatMap((application) => {
    const maintainedStateId = targets.get(application.targetActorId)?.maintained.id
    return maintainedStateId ? [{ ...application, maintainedStateId }] : []
  })
  if (checksumRuleDocument(remaining) !== checksumRuleDocument(context.remaining))
    throw new Error('The concentration damage does not match its finalized parent receipt.')
  const current = targets.get(context.application.targetActorId)
  if (!current) throw new Error('The concentration occurrence is unavailable.')
  const rebuilt = createNativeConcentrationContext({ ...context, current })
  if (
    checksumRuleDocument(rebuilt.context) !== checksumRuleDocument(context) ||
    continuation.graph.source.definitionId !== current.published.id ||
    continuation.graph.source.checksum !== current.published.checksum ||
    checksumRuleDocument(continuation.facts) !== checksumRuleDocument(rebuilt.facts)
  )
    throw new Error('The concentration occurrence is stale.')
  const now = new Date().toISOString()
  const sceneScope = membership.role === 'OWNER' ? 'OWNER' : 'MEMBER'
  if (snapshot.deferredCleaving) {
    const deferred = await rebuildNativeDeferredCleaving(ctx, {
      state,
      context: snapshot.deferredCleaving,
      sceneScope
    })
    if (
      !deferred ||
      checksumRuleDocument(deferred.applicationContext) !==
        checksumRuleDocument(snapshot.deferredCleaving)
    )
      throw new Error('The deferred Cleaving choice is stale.')
  }
  const completed = await executeNativeConcentrationCheck(ctx, {
    state,
    actors,
    current,
    context,
    continuation,
    resolution,
    occurrenceVersion: occurrence.version + 1,
    userId,
    occurredAt: now
  })
  // Remaining checks auto-roll by their roller's preference until one prompts (D23).
  const chain = await planNativeConcentrationChain(ctx, {
    state,
    readVersion: state.version,
    actors: completed.actors,
    parentOccurrenceId: context.parentOccurrenceId,
    parentCommandFingerprint: context.parentCommandFingerprint,
    finalizedDamageEnvelopeChecksum: context.finalizedDamageEnvelopeChecksum,
    sourceLabels: context.sourceLabels,
    remaining: context.remaining.filter(
      (entry) => !completed.failed || entry.maintainedStateId !== context.maintainedState.id
    ),
    correlationId: occurrence.id,
    userId,
    // Each remaining check is its actor's save, so its primary controller's preference applies.
    autoRollByActorId: await readEncounterAutoRollByActorId(ctx, {
      campaign,
      initiatorUserId: campaign.ownerUserId,
      actors
    }),
    occurredAt: now
  })
  // One version advance covers every check this commit settled.
  const commitFailed = completed.failed || chain.failed
  const nextState = commitFailed
    ? encounterRunStateSchema.parse({ ...state, version: state.version + 1, updatedAt: now })
    : state
  const facts = buildEncounterActorRuleFacts({ actors: chain.actors })
  const rules = reconcileEncounterActorRuleOutput(
    evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
    facts
  )
  const nextProjection = commitFailed
    ? await projectNativeGm(ctx, nextState, chain.actors, rules)
    : projection
  const result = encounterCommandResultDtoSchema.parse({
    projection: nextProjection,
    roll: null,
    occurrence: {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version + 1,
      status: 'COMPLETE',
      outcome: completed.failed ? 'SAVE_FAILURE' : 'SAVE_SUCCESS',
      pending: null
    }
  })
  if (commitFailed)
    await ctx.db.patch(run._id, {
      version: nextState.version,
      stateJson: JSON.stringify(nextState),
      stateChecksum: checksumCanonicalJson(nextState),
      projectionJson: JSON.stringify(nextProjection),
      projectionChecksum: checksumCanonicalJson(nextProjection),
      updatedAt: now
    })
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: response.commandId,
      commandType: response.type,
      ruleOccurrenceId: occurrence.id,
      ruleResultChecksum: checksumRuleDocument(completed.result),
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
      commandFingerprint: fingerprint,
      actorUserId: userId,
      version: nextState.version,
      commandJson: JSON.stringify(response),
      resultJson: JSON.stringify(result),
      resultChecksum: checksumCanonicalJson(result),
      createdAt: now
    })
  )
  await persistNativeConcentrationResult(ctx, {
    state: nextState,
    result: completed.result,
    occurrence,
    commandId: response.commandId,
    fingerprint,
    userId,
    correlationId: response.correlationId ?? null,
    occurredAt: now,
    metadata: {
      schemaVersion: 1,
      transition: 'RESUME',
      expectedAggregateVersion: response.expectedVersion,
      expectedOccurrenceVersion: response.expectedOccurrenceVersion,
      response: { requestId: resolution.requestId, value: completed.selectedNatural },
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
    }
  })
  await persistNativeConcentrationChain(ctx, {
    state: nextState,
    chain,
    userId,
    occurredAt: now,
    deferredCleaving: snapshot.deferredCleaving
  })
  if (!chain.pending && snapshot.deferredCleaving) {
    // The pre-cleanup choice was checked above. Only this transaction's cleanup may change its pins.
    const deferred = await rebuildNativeDeferredCleaving(ctx, {
      state: nextState,
      context: snapshot.deferredCleaving,
      sceneScope
    })
    if (deferred) await insertNativeCleavingChoice(ctx, nextState, deferred, now)
  }
  return presentEncounterResultForMember(ctx, {
    campaign,
    membership,
    result: encounterCommandResultDtoSchema.parse({ ...result, projection: nextProjection })
  })
}
