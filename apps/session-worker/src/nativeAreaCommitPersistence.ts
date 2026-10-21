import {
  type RemoveAreaTargetInputDto,
  type ResolveEncounterActionInputDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { ServerAggregateChoicePendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { type LiveSessionForcedMovement } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { prepareNativeZoneSourceGrantEffect } from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import { projectNativeActionEffectTransitions } from '@artificer-toolkit/rules-runtime/encounterActionEffectReceipts'
import { buildEncounterMaintenanceTransition } from '@artificer-toolkit/rules-runtime/encounterActionMaintenance'
import {
  createNativeActiveEffect,
  nativeEffectOwner,
  projectNativeLiveMaintenanceOwners
} from './nativeEncounterSettlement.js'
import {
  planNativeEncounterActionMechanics,
  planNativeEncounterAreaSourceSpend
} from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import { buildEncounterAreaStoredExecution } from '@artificer-toolkit/rules-runtime/encounterActionReceipt'
import { encounterActionSourceLabel } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { actionEndedEffects } from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { projectEncounterActionTarget } from '@artificer-toolkit/rules-runtime/encounterActionProjection'
import { applyEncounterAttackActionTransition } from '@artificer-toolkit/rules-runtime/encounterAttackAction'
import { withFeatureChargeUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  nativeConcentrationDamageApplications,
  nativeConcentrationDamageSourceLabels
} from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'
import { planNativeLiveConcentration } from './nativeEncounterConcentration.js'
import { prepareNativeLiveMaintainedState } from './nativeEncounterMaintenance.js'
import { counterConsumptionsOf } from './nativeEncounterCastReaction.js'
import type {
  AreaPlanBase,
  AreaPrepared,
  AreaReach,
  MovementTargets,
  ReachCastWindow,
  reachRuleOverrides
} from './nativeAreaPreparation.js'
import type { prepareAreaCommitMaintenance } from './nativeAreaCommitMaintenance.js'
import type { planAreaOutcomes } from './nativeAreaCommitPlan.js'

/**
 * Settles an area commit's write-set: the caster's single spend (merged into their own outcome when
 * they are also a target), the actors as persistence leaves them, the Concentration the damage
 * breaks, the rules as they stand after it, and the root contract the room persists.
 */
export async function settleAreaCommit(args: {
  input: AreaPlanBase
  command: ResolveEncounterActionInputDto
  caster: EncounterRunActorState
  occurredAt: string
  lead: AreaPrepared
  placement: AreaReach['placement']
  movementTargets: ReadonlyMap<string, MovementTargets>
  areaOccurrenceId: string
  areaSnapshot: ServerAggregateChoicePendingSnapshotDto | null
  occurrenceVersion: number
  caughtChecksum: string
  removedActorIds: readonly string[]
  unaffectedActorIds: readonly string[]
  response: ResolveRuleOccurrenceInputDto | null
  removal: RemoveAreaTargetInputDto | null
  rollsPerTarget: boolean
  ruleOverrides: ReturnType<typeof reachRuleOverrides>
  failedCounters: readonly Awaited<
    ReturnType<ReachCastWindow['pause']['planFailedCounters']>
  >[number][]
  actionEconomy:
    | NonNullable<
        Awaited<ReturnType<typeof evaluateNativeLiveActionEconomy>>['economy']
      >['consumption']
    | null
  attackAction: Awaited<ReturnType<typeof evaluateNativeLiveActionEconomy>>['attackAction']
  forcedMovements: readonly LiveSessionForcedMovement[]
  casterCounterConsumptions: ReturnType<typeof counterConsumptionsOf>
  consumedGrants: ReturnType<typeof actionEndedEffects>['consumedGrants']
  sourceReleases: ReturnType<typeof actionEndedEffects>['sourceReleases']
  maintenance: Awaited<ReturnType<typeof prepareAreaCommitMaintenance>>['maintenance']
  removedIds: ReadonlySet<string>
  planZones: Awaited<ReturnType<typeof prepareAreaCommitMaintenance>>['planZones']
  outcomes: Awaited<ReturnType<typeof planAreaOutcomes>>
  maintainedState: ReturnType<typeof prepareNativeLiveMaintainedState> | null
  zoneMaintenanceTransition: ReturnType<typeof buildEncounterMaintenanceTransition> | null
}) {
  const {
    input,
    command,
    caster,
    occurredAt,
    lead,
    placement,
    movementTargets,
    areaOccurrenceId,
    areaSnapshot,
    occurrenceVersion,
    caughtChecksum,
    removedActorIds,
    unaffectedActorIds,
    response,
    removal,
    rollsPerTarget,
    ruleOverrides,
    failedCounters,
    actionEconomy,
    attackAction,
    forcedMovements,
    casterCounterConsumptions,
    consumedGrants,
    sourceReleases,
    maintenance,
    removedIds,
    planZones,
    maintainedState,
    zoneMaintenanceTransition
  } = args
  const { children, createdEffects, damageEndedEffects } = args.outcomes
  const { state, actors } = input
  const userId = input.initial.expectedUserId
  const merged = children.find((child) => child.carriesSpend)
  const resourceState = lead.characterActionState
  const spends = Boolean(
    resourceState?.resourceConsumption ||
    resourceState?.itemConsumption ||
    resourceState?.spellConsumption ||
    lead.acceptedWieldConflict ||
    casterCounterConsumptions.length > 0
  )
  const sourceSpend = merged
    ? null
    : planNativeEncounterAreaSourceSpend(
        {
          prepared: lead,
          encounterId: state.id,
          expectedEncounterVersion: state.version,
          occurrenceId: areaOccurrenceId,
          sourceCommandId: command.commandId,
          commandId: command.commandId,
          occurredAt,
          sourceReleases,
          counterSpellConsumptions: casterCounterConsumptions
        },
        userId
      )
  const spend = merged
    ? {
        sourceApplications: [],
        sourceCharacterStreamVersion: spends
          ? merged.mechanics.mechanics.characterStreamVersion
          : null,
        resourceReceipt: merged.mechanics.resourceReceipt,
        featureResourceReceipt: merged.mechanics.featureResourceReceipt,
        sourceItemUseStateTransition: merged.mechanics.sourceItemUseStateTransition,
        itemConsumptionReceipt: merged.mechanics.itemConsumptionReceipt,
        spellConsumptionReceipt: merged.mechanics.spellConsumptionReceipt
      }
    : sourceSpend!
  const sourceLabel = encounterActionSourceLabel(lead.source)
  const damageSources = children.map((child) => ({
    targetActorId: child.actorId,
    applications: child.mechanics.mechanics.receiptApplications,
    sourceLabel
  }))
  const damage = nativeConcentrationDamageApplications(damageSources, false)
  const placedZones = planZones(maintainedState?.id ?? null)
  // The placed zone's timed grant lands on the creature that placed it (D153).
  const zoneSourceGrant =
    placedZones.length && placement?.zone.sourceGrant
      ? createNativeActiveEffect(
          prepareNativeZoneSourceGrantEffect({
            prepared: lead,
            plan: placement.zone.sourceGrant,
            published:
              lead.plan.kind === 'SINGLE_GRAPH' ? lead.plan.published : lead.plan.test.published,
            occurrenceId: areaOccurrenceId,
            commandId: command.commandId,
            activeEffectsByActorId: input.activeEffectsByActorId
          }),
          {
            owner: nativeEffectOwner(caster, state.id),
            currentEffects: [
              ...(input.activeEffectsByActorId.get(caster.id) ?? []).filter(
                (effect) => !maintainedState || !removedIds.has(effect.id)
              ),
              ...(createdEffects.get(caster.id) ?? [])
            ],
            occurredAt
          }
        )
      : null
  if (zoneSourceGrant)
    createdEffects.set(caster.id, [...(createdEffects.get(caster.id) ?? []), zoneSourceGrant])
  const execution = buildEncounterAreaStoredExecution({
    occurrenceId: areaOccurrenceId,
    occurrenceVersion,
    actorId: caster.id,
    sourceCharacterId: caster.kind === 'CHARACTER' ? caster.sourceId : null,
    caughtChecksum,
    removedActorIds,
    targetOccurrenceIds: children.map((child) => child.occurrenceId),
    placedSpatialEffectIds: placedZones.map(({ id }) => id),
    maintenanceTransition: zoneMaintenanceTransition,
    sourceGrantTransition: zoneSourceGrant
      ? projectNativeActionEffectTransitions({
          state: null,
          recurring: zoneSourceGrant,
          targetActorId: caster.id
        }).activeEffectTransitions[0]!
      : null,
    damage,
    spend,
    actionEconomy,
    attackAction
  })

  // The actors as persistence leaves them: the caster's resource write, each outcome, each charge a
  // Legendary Resistance spent, then the caster's feature charge, action economy and Attack action.
  const settledActors = new Map(actors.map((actor) => [actor.id, actor] as const))
  if (sourceSpend?.sourceResourcePlan)
    settledActors.set(caster.id, sourceSpend.sourceResourcePlan.updatedActor)
  for (const child of children) {
    const updated = child.mechanics.mechanics.updatedActor
    const charge = child.resistance?.charge
    settledActors.set(
      child.actorId,
      charge
        ? encounterRunActorStateSchema.parse({
            ...updated,
            resources: withFeatureChargeUsed(updated, charge.ownerFeatureId, charge.afterUsed)
          })
        : updated
    )
  }
  // A creature that failed to counter the cast has spent its reaction. A kept creature pays it in its
  // own outcome; the caster's and any other creature's are paid by persistence.
  for (const { receipt, economy } of failedCounters) {
    const reactor = settledActors.get(receipt.reaction.reactorActorId)
    if (
      reactor &&
      reactor.id !== caster.id &&
      children.some((child) => child.actorId === reactor.id)
    )
      settledActors.set(
        reactor.id,
        consumeEncounterActionEconomy({ actor: reactor, consumption: economy, overridden: false })
      )
  }
  let settledCaster = settledActors.get(caster.id)!
  if (spend.featureResourceReceipt)
    settledCaster = encounterRunActorStateSchema.parse({
      ...settledCaster,
      resources: withFeatureChargeUsed(
        settledCaster,
        spend.featureResourceReceipt.ownerFeatureId,
        spend.featureResourceReceipt.afterUsed
      )
    })
  if (actionEconomy)
    settledCaster = consumeEncounterActionEconomy({
      actor: settledCaster,
      consumption: actionEconomy,
      overridden: overridesActionEconomy(ruleOverrides)
    })
  if (attackAction)
    settledCaster = applyEncounterAttackActionTransition(settledCaster, attackAction)
  settledActors.set(caster.id, settledCaster)
  const plans = new Map<
    string,
    ReturnType<typeof planNativeEncounterActionMechanics>['targetPlan'] | null
  >(children.map((child) => [child.actorId, child.mechanics.targetPlan] as const))
  if (sourceSpend && !plans.has(caster.id)) plans.set(caster.id, sourceSpend.sourceResourcePlan)
  const replaced = maintainedState && maintenance ? maintenance : null
  const activeEffectsByActorId = new Map(
    [...input.activeEffectsByActorId].map(([actorId, records]) => [
      actorId,
      replaced ? records.filter((effect) => !removedIds.has(effect.id)) : records
    ])
  )
  for (const [actorId, records] of createdEffects)
    activeEffectsByActorId.set(actorId, [
      ...(activeEffectsByActorId.get(actorId) ?? []),
      ...records
    ])
  const projectedTargets = new Map(
    [...movementTargets].map(([actorId, target]) => {
      const actor = settledActors.get(actorId)
      if (!actor) throw new Error('Encounter settlement actor is unavailable.')
      return [
        actorId,
        projectEncounterActionTarget({
          target: {
            ...target,
            activeEffects: activeEffectsByActorId.get(actorId) ?? []
          },
          actor,
          plan: plans.get(actorId) ?? null,
          campaignId: state.campaignId,
          gameSystemId: state.gameSystemId,
          occurredAt
        })
      ] as const
    })
  )
  const reconciled = projectNativeLiveMaintenanceOwners({
    actors: actors.map((actor) => settledActors.get(actor.id)!),
    projectedTargets,
    activeEffectsByActorId,
    maintenance: replaced ?? { owners: [], removed: [], characterVersions: [] },
    createdEffects: [...createdEffects.values()].flat(),
    characterPlans: plans,
    campaignId: state.campaignId,
    gameSystemId: state.gameSystemId,
    occurredAt
  })
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: occurredAt
  })
  const concentration = await planNativeLiveConcentration({
    state: nextState,
    autoRollByActorId: input.autoRollByActorId,
    parentOccurrenceId: areaOccurrenceId,
    parentCommandFingerprint: input.fingerprint,
    applications: damage,
    sourceLabels: nativeConcentrationDamageSourceLabels(damageSources, false),
    occurredAt,
    settlement: {
      ...reconciled,
      maintainedState,
      createdEffects: [...createdEffects.values()].flat()
    },
    capture: input.capture,
    runtime: input.runtime,
    random: input.random
  })
  const nextFacts = buildEncounterActorRuleFacts({
    actors: concentration.actors
  })
  const rules = reconcileEncounterActorRuleOutput(
    evaluateInstalledEncounterActors({
      gameSystemId: state.gameSystemId,
      facts: nextFacts
    }),
    nextFacts,
    { output: lead.actorRules }
  )
  return {
    kind: 'AREA_COMMIT' as const,
    command,
    response,
    removal,
    area: areaSnapshot,
    unaffectedActorIds: [...unaffectedActorIds],
    prepared: { actors },
    occurredAt,
    initialDefinitionId:
      children[0]?.complete.initialPublished.id ??
      (lead.plan.kind === 'SINGLE_GRAPH' ? lead.plan.published.id : lead.plan.test.published.id),
    execution,
    targets: children.map(({ actorId, execution: targetExecution, createdEffects: created }) => ({
      actorId,
      execution: targetExecution,
      createdEffects: created
    })),
    rollsPerTarget,
    rules,
    maintainedState,
    resourceConsumption: resourceState?.resourceConsumption ?? null,
    itemConsumption: resourceState?.itemConsumption ?? null,
    spellConsumption: resourceState?.spellConsumption ?? null,
    failedCounters,
    consumedGrants: [...consumedGrants, ...damageEndedEffects.values()],
    label: sourceLabel,
    ruleOverrides,
    concentration,
    placedZones,
    zoneSourceGrant,
    forcedMovements
  }
}
