import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  liveSessionEncounterCleavingCommitInputSchema,
  type LiveSessionEncounterCleavingCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterCleaving'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { projectEncounterActionTarget } from '@artificer-toolkit/rules-runtime/encounterActionProjection'
import { encounterActionSourceLabel } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import {
  cleavingCarriesOn,
  cleavingDamageApplication,
  cleavingDamageEnvelope
} from '@artificer-toolkit/rules-runtime/encounterCleavingFacts'
import { createNativeCleavingChoice } from '@artificer-toolkit/rules-runtime/encounterCleavingChoice'
import { cleavingChildCommandIdentity } from '@artificer-toolkit/rules-runtime/encounterCleavingIdentity'
import {
  nativeConcentrationDamageApplications,
  nativeConcentrationDamageSourceLabels
} from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import { liveEncounterCaptures, type LiveCaptureReads } from './nativeEncounterReads.js'
import { readNativeLiveCleavingStep } from './nativeEncounterCleaving.js'
import { planNativeLiveConcentration } from './nativeEncounterConcentration.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'

/**
 * Plans one admitted Cleaving answer in the room: the chosen target takes the retained damage, its
 * Concentration checks run, and an overkill offers the next target. Convex only re-applies and records.
 */
export async function planNativeLiveCleavingResponse(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  response: ResolveRuleOccurrenceInputDto,
  executionOptions: {
    runtime: RulesRuntimeService
    random(maximum: number): number
    captures: LiveCaptureReads
  }
) {
  const request = { kind: 'CLEAVING_RESPONSE' as const, response }
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
    throw new Error('Live Cleaving response scope mismatch.')
  const reads = liveEncounterCaptures(initial, executionOptions.captures)
  const { capture } = reads
  const admission = await capture(request)
  if (admission.result) return { kind: 'REPLAY' as const, result: admission.result }
  const snapshot = admission.snapshot
  const optionalCombatSnapshotChecksum = snapshot?.optionalCombatSnapshotChecksum
  if (
    !snapshot ||
    !optionalCombatSnapshotChecksum ||
    snapshot.applicationContext.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING'
  )
    throw new Error('The Cleaving choice is unavailable.')
  const context = snapshot.applicationContext
  const { state, system } = await capture({ kind: 'INPUTS' })
  if (state.id !== initial.encounterId || state.version !== initial.expectedVersion)
    throw new Error('Cleaving Run inputs changed during capture.')
  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })
  const loaded = new Map<
    string,
    Awaited<ReturnType<typeof prepareNativeLiveMovementTarget>>['target']
  >()
  async function loadTarget(actor: (typeof actors)[number]) {
    const existing = loaded.get(actor.id)
    if (existing) return existing
    const prepared = await prepareNativeLiveMovementTarget({
      scope: initial,
      state,
      actor,
      activeEffectsByActorId,
      ...executionOptions
    })
    reads.observe(prepared.revisions)
    loaded.set(actor.id, prepared.target)
    return prepared.target
  }
  const occurredAt = new Date().toISOString()
  const reader = { occurredAt, initialActors: actors, loadTarget, capture, system }
  const resolution = response.resolution
  const selected =
    resolution.kind === 'OPTION'
      ? context.options.find((option) => option.optionId === resolution.optionId)
      : undefined
  let chosen: {
    target: Awaited<ReturnType<typeof loadTarget>>
    sourceLabel: string | null
  } | null = null
  if (selected) {
    const step = await readNativeLiveCleavingStep({
      ...reader,
      state,
      context,
      projection: {
        actors,
        projectedTargets: new Map(),
        activeEffectsByActorId,
        maintenanceOwners: []
      }
    })
    const rebuilt = createNativeCleavingChoice({
      ...state,
      ...context,
      optionalCombatSnapshotChecksum,
      sourceCurrentness: step.sourceCurrentness,
      chainStep: context.chainStep - 1,
      candidates: step.candidates
    })
    if (!rebuilt || checksumCanonicalJson(rebuilt) !== checksumCanonicalJson(snapshot))
      throw new Error('Cleaving policy, target, or Scene is stale.')
    const target = step.targets.get(selected.targetActorId)
    if (!target)
      throw new LiveSessionDomainRejectionError(422, {
        code: 'DOMAIN_REJECTED',
        reason: 'TARGET_UNAVAILABLE',
        message: 'Cleaving target is unavailable.'
      })
    chosen = { target, sourceLabel: encounterActionSourceLabel(step.source) }
  }
  const remaining = context.damage.remainingAmount
  const application = chosen
    ? cleavingDamageApplication({
        damage: context.damage,
        targetActorId: chosen.target.actor.id,
        before: {
          current: chosen.target.state.current,
          temporary: chosen.target.state.temporary,
          maximum: chosen.target.effectiveMaximumHitPoints
        }
      })
    : null
  const mechanics =
    chosen && application
      ? planEncounterMechanicsBatch({
          batch: {
            encounterId: state.id,
            targetActorId: chosen.target.actor.id,
            expectedEncounterVersion: state.version,
            occurrenceId: snapshot.occurrenceId,
            sourceCommandId: cleavingChildCommandIdentity(snapshot.occurrenceId),
            commandId: response.commandId,
            occurredAt,
            applications: [application],
            expectedCharacterStreamVersion:
              chosen.target.characterFacts?.active.play.streamVersion ?? null,
            effectiveMaximumHitPoints: chosen.target.effectiveMaximumHitPoints,
            damageInterceptions: chosen.target.damageInterceptions,
            sheetMaximumHitPoints: chosen.target.sheetMaximumHitPoints,
            effectiveScalarValues: chosen.target.effectiveScalarValues,
            forceVersionAdvance: false
          },
          actor: chosen.target.actor,
          userId: initial.expectedUserId,
          ...(chosen.target.characterFacts ? { characterFacts: chosen.target.characterFacts } : {})
        })
      : null
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: occurredAt
  })
  const damaged = actors.map((actor) =>
    actor.id === mechanics?.updatedActor.id ? mechanics.updatedActor : actor
  )
  const damage =
    chosen && mechanics
      ? [
          {
            targetActorId: chosen.target.actor.id,
            applications: mechanics.receiptApplications,
            sourceLabel: chosen.sourceLabel
          }
        ]
      : []
  const concentration = await planNativeLiveConcentration({
    state: nextState,
    autoRollByActorId: admission.autoRollByActorId,
    parentOccurrenceId: snapshot.occurrenceId,
    parentCommandFingerprint: admission.fingerprint,
    applications: nativeConcentrationDamageApplications(damage, true),
    sourceLabels: nativeConcentrationDamageSourceLabels(damage, true),
    occurredAt,
    settlement: {
      actors: damaged,
      projectedTargets: new Map(
        chosen && mechanics
          ? [
              [
                chosen.target.actor.id,
                projectEncounterActionTarget({
                  target: chosen.target,
                  actor: mechanics.updatedActor,
                  plan: mechanics,
                  campaignId: state.campaignId,
                  gameSystemId: state.gameSystemId,
                  occurredAt
                })
              ]
            ]
          : []
      ),
      activeEffectsByActorId,
      maintenanceOwners: [],
      maintainedState: null,
      createdEffects: []
    },
    capture,
    runtime: executionOptions.runtime,
    random: executionOptions.random
  })
  const facts = buildEncounterActorRuleFacts({ actors: concentration.actors })
  const rules = reconcileEncounterActorRuleOutput(
    evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
    facts
  )
  const execution = storedRuleExecutionResultDtoSchema.parse({
    status: 'AGGREGATE_CHOICE_COMPLETE',
    schemaVersion: 1,
    occurrenceId: snapshot.occurrenceId,
    occurrenceVersion: response.expectedOccurrenceVersion + 1,
    applicationOutputs: {
      kind: 'CLEAVING_DAMAGE',
      schemaVersion: 1,
      occurrenceId: snapshot.occurrenceId,
      parentOccurrenceId: context.parentOccurrenceId,
      sourceActorId: context.sourceActorId,
      targetActorId: selected?.targetActorId ?? null,
      selectedOptionId: selected?.optionId ?? null,
      sealedContextChecksum: checksumRuleDocument(context),
      outcome: selected ? 'APPLIED' : 'DECLINED',
      damage: {
        sourceNodeId: context.damage.sourceNodeId,
        sourceOperationKey: context.damage.sourceOperationKey,
        damageTypeId: context.damage.damageTypeId,
        requestedAmount: remaining,
        resolvedAmount: remaining,
        appliedAmount: application?.appliedAmount ?? 0
      },
      targetTransition: mechanics?.targetTransition ?? null
    }
  })
  let cleaving: LiveSessionEncounterCleavingCommitInput['cleaving'] = null
  if (chosen && application && cleavingCarriesOn(application)) {
    const visitedTargetActorIds = [...context.visitedTargetActorIds, chosen.target.actor.id]
    const step = await readNativeLiveCleavingStep({
      ...reader,
      state: nextState,
      context: { ...context, visitedTargetActorIds },
      projection: concentration
    })
    cleaving = createNativeCleavingChoice({
      ...nextState,
      ...context,
      sourceCurrentness: step.sourceCurrentness,
      optionalCombatSnapshotChecksum,
      parentOccurrenceId: snapshot.occurrenceId,
      parentResultChecksum: checksumRuleDocument(execution),
      visitedTargetActorIds,
      damage: cleavingDamageEnvelope({ ...application, targetActorId: chosen.target.actor.id }),
      candidates: step.candidates
    })
  }
  const maintenanceOwners = new Map(
    reads.dependencies.flatMap(({ request }) =>
      request.kind === 'MAINTENANCE_OWNER'
        ? [[checksumRuleDocument(request), request] as const]
        : []
    )
  )
  const input = liveSessionEncounterCleavingCommitInputSchema.parse({
    ...scope,
    response,
    revisions: reads.revisions(),
    occurredAt,
    execution,
    rules,
    maintenanceOwners: [...maintenanceOwners.values()],
    concentration: concentration.completed,
    pendingConcentration: concentration.pending,
    concentrationEnds: concentration.concentrationEnds,
    endedGrants: concentration.endedGrants,
    cleaving
  })
  return { kind: 'PLANNED' as const, input }
}
