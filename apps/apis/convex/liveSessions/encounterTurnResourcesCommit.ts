import {
  encounterRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import { dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/encounterLifecycle'
import { ruleCapabilityReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleState'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import {
  completedTurnRechargePlanDtoSchema,
  turnLegendaryActionEvidenceDtoSchema
} from '@artificer-toolkit/schema/shared/ruleExecutionTurnResources'
import {
  featureChargeUsed,
  encounterRuleUsageUsed,
  requireSnapshotIdentity,
  snapshotFeatureDefinitions,
  withEncounterRuleUsageUsed,
  withFeatureChargeUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { actionEconomyCapabilityRegistry } from '@artificer-toolkit/rules-runtime/actionEconomyCapabilityRegistry.default'
import { applyStagedLegendaryActionRefreshes } from '@artificer-toolkit/rules-runtime/encounterLegendaryActionDiscovery'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'

import type { MutationCtx } from '../_generated/server'
import { readDefinitionRoot } from '../content/definitionStore'
import { readRunActor } from '../encounters/documents'
import { applyLiveEncounterMechanicsBatch } from './encounterActionMechanics'

/** Applies only the sealed resource outcomes after outgoing effects have committed. */
export async function persistLiveTurnResources(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    root: TurnCoordinatorRootDto
    occurrenceId: string
    occurredAt: string
    userId: string
  }
): Promise<void> {
  const { state, root, occurrenceId, occurredAt, userId } = input
  const actions = root.completedLegendaryActions ?? []
  const legendaryRefreshes = root.stagedLegendaryActionRefreshes ?? []
  const economyRefreshes = root.stagedActionEconomyRefreshes ?? []
  const recharge = root.completedRechargePlan
    ? completedTurnRechargePlanDtoSchema.parse(root.completedRechargePlan)
    : null
  if (
    (root.commandType === 'START' && actions.length > 0) ||
    root.expectedEncounterVersion !== state.version ||
    (state.automationMode === 'MANUAL' &&
      (actions.length > 0 ||
        legendaryRefreshes.length > 0 ||
        economyRefreshes.length > 0 ||
        recharge))
  )
    throw new Error('Live Session turn resource boundary is stale.')
  const enteringId = root.proposedTerminalTransition.currentActorId
  if (
    (!enteringId && (legendaryRefreshes.length || economyRefreshes.length || recharge)) ||
    (recharge && recharge.executions.some((entry) => entry.candidate.actorId !== enteringId))
  )
    throw new Error('Live Session incoming resource owner is stale.')

  async function currentDefinition(id: string) {
    const definition = await readDefinitionRoot(ctx, id, userId)
    if (
      !definition?.current ||
      definition.current.id !== id ||
      definition.current.gameSystemId !== state.gameSystemId ||
      checksumRuleDocument(definition.current.document) !== definition.current.checksum
    )
      throw new Error('Live Session turn resource definition is stale.')
    return definition.current
  }

  async function readActor(actorId: string) {
    const actor = await readRunActor(ctx, state, actorId)
    requireSnapshotIdentity(actor)
    if (actor.systemId !== state.gameSystemId || actor.encounterId !== state.id)
      throw new Error('Live Session turn resource actor is stale.')
    return actor
  }

  async function writeActor(before: EncounterRunActorState, after: EncounterRunActorState) {
    if (checksumCanonicalJson(before) === checksumCanonicalJson(after)) return
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', state.id).eq('id', before.id))
      .unique()
    if (
      !row ||
      row.stateChecksum !== checksumCanonicalJson(before) ||
      after.id !== before.id ||
      after.encounterId !== before.encounterId ||
      after.systemId !== before.systemId ||
      after.kind !== before.kind ||
      after.sourceId !== before.sourceId ||
      after.sourceRevision !== before.sourceRevision
    )
      throw new Error('Live Session turn resource actor changed before settlement.')
    const next = encounterRunActorStateSchema.parse({ ...after, updatedAt: occurredAt })
    await ctx.db.patch(row._id, {
      stateJson: JSON.stringify(next),
      stateChecksum: checksumCanonicalJson(next)
    })
  }

  const seenOwners = new Set<string>()
  for (const raw of actions) {
    const evidence = turnLegendaryActionEvidenceDtoSchema.parse(raw)
    const ownerId = evidence.choice.ownerActorId
    if (seenOwners.has(ownerId) || ownerId === state.currentActorId)
      throw new Error('Live Session Legendary Action owner is stale.')
    seenOwners.add(ownerId)
    if (evidence.resolution.kind === 'DECLINED') continue
    const selectedOptionId = evidence.resolution.selectedOptionId
    const option = evidence.choice.options.find((entry) => entry.optionId === selectedOptionId)
    const application = evidence.resolution.application
    if (
      !option ||
      option.targetActorId !== ownerId ||
      application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH' ||
      application.occurrenceId !== occurrenceId ||
      application.sourceActorId !== ownerId ||
      application.targetActorId !== ownerId ||
      application.sourceCharacterStreamVersion !== null ||
      application.resourceConsumption !== null ||
      application.spellCastConsumption !== null ||
      application.targetFeatureResourceConsumption !== null ||
      application.legendaryResistance !== null ||
      application.activeEffectTransitions.length !== 0 ||
      application.stateEffectTransitions.length !== 0 ||
      application.maintenanceTransition != null ||
      evidence.resolution.characterTransitions.length !== 0
    )
      throw new Error('Live Session Legendary Action application is unavailable.')
    const owner = await readActor(ownerId)
    if (owner.kind !== 'CREATURE')
      throw new Error('Live Session Legendary Action owner is unavailable.')
    const feature = snapshotFeatureDefinitions(owner).find(
      (entry) => entry.id === option.ownerFeatureId
    )
    const charge = feature?.charges
    const resource = application.featureResourceConsumption
    if (
      !feature ||
      !charge ||
      charge.limitKind !== 'FIXED_AMOUNT' ||
      charge.scalingKind !== 'NONE' ||
      charge.id !== option.chargeId ||
      !resource ||
      resource.ownerActorId !== ownerId ||
      resource.ownerFeatureId !== feature.id ||
      resource.chargeId !== charge.id ||
      resource.beforeUsed !== featureChargeUsed(owner, feature.id) ||
      resource.afterUsed !== resource.beforeUsed + resource.cost ||
      resource.beforeRemaining !== charge.amount - resource.beforeUsed ||
      resource.afterRemaining !== charge.amount - resource.afterUsed ||
      resource.cost !== option.featureCost ||
      resource.afterUsed > charge.amount ||
      !feature.ruleDefinitionIds?.includes(option.lifecycle.definitionId)
    )
      throw new Error('Live Session Legendary Action resource is stale.')
    const lifecycle = await currentDefinition(option.lifecycle.definitionId)
    const lifecycleDocument = dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.safeParse(
      lifecycle.document
    )
    const graph = await currentDefinition(option.lifecycle.eligibilityGraphDefinitionId)
    if (
      lifecycle.version !== option.lifecycle.definitionVersion ||
      lifecycle.checksum !== option.lifecycle.definitionChecksum ||
      !lifecycleDocument.success ||
      lifecycleDocument.data.kind !== 'LEGENDARY_ACTION' ||
      lifecycleDocument.data.id !== lifecycle.id ||
      lifecycleDocument.data.gameSystemId !== state.gameSystemId ||
      lifecycleDocument.data.eligibilityGraph.definitionId !==
        option.lifecycle.eligibilityGraphDefinitionId ||
      lifecycleDocument.data.eligibilityGraph.definitionVersion !==
        option.lifecycle.eligibilityGraphDefinitionVersion ||
      lifecycleDocument.data.eligibilityGraph.definitionChecksum !==
        option.lifecycle.eligibilityGraphDefinitionChecksum ||
      lifecycleDocument.data.eligibilityGraph.eligibleOutput !== option.lifecycle.eligibleOutput ||
      graph.version !== option.lifecycle.eligibilityGraphDefinitionVersion ||
      graph.checksum !== option.lifecycle.eligibilityGraphDefinitionChecksum ||
      !ruleGraphDefinitionDtoSchema.safeParse(graph.document).success
    )
      throw new Error('Live Session Legendary Action lifecycle is stale.')
    const mechanics = await applyLiveEncounterMechanicsBatch(ctx, {
      encounterId: state.id,
      targetActorId: ownerId,
      expectedEncounterVersion: state.version,
      occurrenceId,
      sourceCommandId: root.rootCommandId,
      commandId: root.rootCommandId,
      occurredAt,
      applications: application.applications.map((entry) => ({ ...entry, targetActorId: ownerId })),
      effectiveMaximumHitPoints: application.targetTransition.before.maximumHitPoints,
      effectiveScalarValues: application.targetTransition.before.scalarValues,
      forceVersionAdvance: false
    })
    if (
      checksumCanonicalJson(mechanics.receiptApplications) !==
        checksumCanonicalJson(application.applications) ||
      checksumCanonicalJson(mechanics.targetTransition) !==
        checksumCanonicalJson(application.targetTransition) ||
      mechanics.characterStreamVersion !== null
    )
      throw new Error('Live Session Legendary Action mechanics receipt mismatch.')
    const settled = mechanics.updatedActor
    if (featureChargeUsed(settled, feature.id) !== resource.beforeUsed)
      throw new Error('Live Session Legendary Action resource changed before settlement.')
    await writeActor(
      settled,
      encounterRunActorStateSchema.parse({
        ...settled,
        resources: withFeatureChargeUsed(settled, feature.id, resource.afterUsed)
      })
    )
  }

  if (legendaryRefreshes.length) {
    if (
      !enteringId ||
      legendaryRefreshes.some(
        (entry, index) => entry.actorId !== enteringId || entry.ordinal !== index
      ) ||
      new Set(legendaryRefreshes.map((entry) => entry.ownerFeatureId)).size !==
        legendaryRefreshes.length
    )
      throw new Error('Live Session Legendary Action refresh owner is stale.')
    const actor = await readActor(enteringId)
    const refreshed = await applyStagedLegendaryActionRefreshes({
      encounter: { gameSystemId: state.gameSystemId, actors: [actor] },
      definitions: { requireCurrent: currentDefinition },
      refreshes: legendaryRefreshes
    })
    if (refreshed.length !== 1)
      throw new Error('Live Session Legendary Action refresh is unavailable.')
    await writeActor(actor, encounterRunActorStateSchema.parse(refreshed[0]))
  }

  if (economyRefreshes.length) {
    const expectedDefinitions =
      actionEconomyCapabilityRegistry.requireRefreshCapabilityDefinitionIds(state.gameSystemId)
    if (
      !enteringId ||
      economyRefreshes.some(
        (entry, index) =>
          entry.actorId !== enteringId ||
          entry.afterUsed !== 0 ||
          entry.ordinal !== index ||
          !expectedDefinitions.includes(entry.capabilityDefinitionId)
      ) ||
      new Set(economyRefreshes.map((entry) => entry.capabilityDefinitionId)).size !==
        economyRefreshes.length
    )
      throw new Error('Live Session action-economy refresh owner is stale.')
    let actor = await readActor(enteringId)
    for (const refresh of economyRefreshes) {
      const definition = await currentDefinition(refresh.capabilityDefinitionId)
      const capability = ruleCapabilityReusableDefinitionDocumentDtoSchema.safeParse(
        definition.document
      )
      if (
        definition.version !== refresh.definitionVersion ||
        definition.checksum !== refresh.definitionChecksum ||
        definition.definitionFamilyKey !== 'rule-capability' ||
        !capability.success ||
        capability.data.id !== definition.id ||
        capability.data.gameSystemId !== state.gameSystemId ||
        !capability.data.usage ||
        capability.data.usage.refreshBoundary !== 'START_OF_TURN' ||
        refresh.beforeUsed > capability.data.usage.maximum ||
        encounterRuleUsageUsed(actor, definition.id) !== refresh.beforeUsed
      )
        throw new Error('Live Session action-economy refresh is stale.')
      const next = encounterRunActorStateSchema.parse({
        ...actor,
        resources: withEncounterRuleUsageUsed(actor, definition.id, 0)
      })
      await writeActor(actor, next)
      actor = await readActor(enteringId)
    }
  }

  if (recharge) {
    if (!enteringId) throw new Error('Live Session Recharge owner is unavailable.')
    const candidates = recharge.executions.map(({ candidate }) => {
      const { ordinal: _ordinal, ...value } = candidate
      return value
    })
    if (recharge.selectionChecksum !== checksumCanonicalJson({ candidates }))
      throw new Error('Live Session Recharge selection is stale.')
    let actor = await readActor(enteringId)
    if (actor.kind !== 'CREATURE') throw new Error('Live Session Recharge owner is unavailable.')
    for (const execution of recharge.executions) {
      const candidate = execution.candidate
      const feature = snapshotFeatureDefinitions(actor).find(
        (entry) => entry.id === candidate.featureId
      )
      const charge = feature?.charges
      if (
        !feature ||
        !charge ||
        charge.limitKind !== 'FIXED_AMOUNT' ||
        charge.scalingKind !== 'NONE' ||
        charge.amount !== candidate.maximum ||
        checksumRuleDocument(feature) !== candidate.featureVersionChecksum ||
        !feature.ruleDefinitionIds?.includes(candidate.policy.definitionId) ||
        featureChargeUsed(actor, feature.id) !== candidate.beforeUsed ||
        execution.beforeUsed !== candidate.beforeUsed ||
        execution.afterUsed !== (execution.recharged ? 0 : candidate.beforeUsed)
      )
        throw new Error('Live Session Recharge resource is stale.')
      const lifecycle = await currentDefinition(candidate.policy.definitionId)
      const graph = await currentDefinition(candidate.policy.graphDefinitionId)
      const lifecycleDocument =
        dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.safeParse(lifecycle.document)
      if (
        lifecycle.version !== candidate.policy.definitionVersion ||
        lifecycle.checksum !== candidate.policy.definitionChecksum ||
        !lifecycleDocument.success ||
        lifecycleDocument.data.kind !== 'RECHARGE' ||
        lifecycleDocument.data.id !== lifecycle.id ||
        lifecycleDocument.data.gameSystemId !== state.gameSystemId ||
        lifecycleDocument.data.rechargeGraph.definitionId !== graph.id ||
        lifecycleDocument.data.rechargeGraph.definitionVersion !== graph.version ||
        lifecycleDocument.data.rechargeGraph.definitionChecksum !== graph.checksum ||
        lifecycleDocument.data.rechargeGraph.rechargedOutput !== candidate.policy.rechargedOutput ||
        graph.version !== candidate.policy.graphDefinitionVersion ||
        graph.checksum !== candidate.policy.graphDefinitionChecksum ||
        !ruleGraphDefinitionDtoSchema.safeParse(graph.document).success
      )
        throw new Error('Live Session Recharge policy is stale.')
      const next = encounterRunActorStateSchema.parse({
        ...actor,
        resources: withFeatureChargeUsed(actor, feature.id, execution.afterUsed)
      })
      await writeActor(actor, next)
      actor = await readActor(enteringId)
    }
  }
}
