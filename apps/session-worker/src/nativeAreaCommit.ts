import {
  type RemoveAreaTargetInputDto,
  type ResolveEncounterActionInputDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { ServerAggregateChoicePendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import {
  liveSessionEncounterAreaCommitInputSchema,
  type LiveSessionForcedMovement
} from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesRequest
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { type EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { encounterAreaLegendaryResistanceAudits } from '@artificer-toolkit/rules-runtime/encounterAreaLegendaryResistance'
import {
  bindingAfterHitPoints,
  settleEncounterAreaAction
} from '@artificer-toolkit/rules-runtime/encounterAreaActionExecution'
import {
  collisionDamageCapability,
  collisionDamageDiceConfig
} from '@artificer-toolkit/rules-runtime/encounterForcedMovementCollision'
import { encounterChosenActorEntries } from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import type { EncounterActorFormCreature } from '@artificer-toolkit/rules-runtime/encounterActorForm'
import { createNativeActiveEffect } from './nativeEncounterSettlement.js'
import { executeEncounterActorsAction } from '@artificer-toolkit/rules-runtime/encounterActorsActionExecution'
import { preparedCastsSpell } from '@artificer-toolkit/rules-runtime/encounterPreparedSpellCast'
import {
  actionEndedEffects,
  actsAgainstEnemy
} from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'
import { interpretForcedMovements } from './nativeEncounterActionInputs.js'
import { counterConsumptionsOf } from './nativeEncounterCastReaction.js'
import { settleAreaCommit } from './nativeAreaCommitPersistence.js'
import { planAreaOutcomes } from './nativeAreaCommitPlan.js'
import {
  openZoneOnlyMaintenance,
  prepareAreaCommitMaintenance
} from './nativeAreaCommitMaintenance.js'
import {
  type AreaPlanBase,
  type AreaPrepared,
  type AreaReach,
  type MovementTargets,
  type ReachCastWindow,
  prepareCasterActionOnTarget,
  reachRuleOverrides
} from './nativeAreaPreparation.js'
import {
  type StruckSaves,
  discoverNativeLegendaryResistance,
  replayAreaTargetSave
} from './nativeAreaRevalidation.js'
import type { planNativeLiveEncounterAreaCommit } from './nativeEncounterAreaRules.js'

/**
 * The collision damage of every mover that travelled 10 feet or more (D159): the mover takes the
 * collision's dice for each full 10 feet, as an unsaved damage action of the pusher's, one more
 * entry after the caught creatures' under the next ordinal occurrence id of its actor. A push whose
 * source still owes a pick settles nothing here; the area holds for the pick and plans again. The
 * creatures the movers struck then settle their sealed saves, one entry each after the movers', on
 * the hit points the area and the collision damage left them.
 */
async function settleForcedMovementCollisions(args: {
  input: AreaPlanBase
  command: ResolveEncounterActionInputDto
  caster: EncounterRunActorState
  movementTargets: ReadonlyMap<string, MovementTargets>
  areaSnapshot: ServerAggregateChoicePendingSnapshotDto | null
  areaOccurrenceId: string
  kept: readonly { actor: EncounterRunActorState; target: { prepared: AreaPrepared } }[]
  settled: Awaited<ReturnType<typeof settleEncounterAreaAction>>
  struck: StruckSaves
  movements: readonly LiveSessionForcedMovement[]
}) {
  const { input, caster, areaOccurrenceId } = args
  const none = {
    kept: [] as { actor: EncounterRunActorState; target: { prepared: AreaPrepared } }[],
    settled: [] as Awaited<ReturnType<typeof settleEncounterAreaAction>>,
    struck: {
      kept: [] as StruckSaves['entries'][number][],
      settled: [] as Awaited<ReturnType<typeof settleEncounterAreaAction>>
    }
  }
  if (!args.movements.some(({ collision }) => collision)) return none
  const context = args.areaSnapshot?.applicationContext
  if (context?.kind !== 'ENCOUNTER_AREA_ACTION')
    throw new Error('A forced-movement collision is resolved only in an area action.')
  const landed = context.forcedMovement?.landed ?? []
  const { owed, landings } = await input.forcedMovementPick({
    encounterId: input.state.id,
    sourceActorId: caster.id,
    movements: args.movements.map((movement) => ({
      ...movement,
      position:
        landed.find(({ targetActorId }) => targetActorId === movement.targetActorId)?.position ??
        null
    }))
  })
  if (owed) return none
  const bindings = new Map<string, AreaPrepared['binding']>()
  for (const [index, { actor, target }] of args.kept.entries())
    bindings.set(
      actor.id,
      bindingAfterHitPoints(
        bindings.get(actor.id) ?? target.prepared.binding,
        args.settled[index]!.complete.applications
      )
    )
  const priorActorIds = args.kept.map(({ actor }) => actor.id)
  for (const { targetActorId, feet } of landings) {
    const collision = args.movements.find(
      (movement) => movement.targetActorId === targetActorId
    )?.collision
    const diceConfig = collision && collisionDamageDiceConfig(collision.diceConfig, feet)
    const mover = input.actors.find(({ id }) => id === targetActorId)
    if (!collision || !diceConfig || !mover) continue
    const occurrenceId = encounterChosenActorEntries(areaOccurrenceId, [
      ...priorActorIds,
      mover.id
    ]).at(-1)!.occurrenceId
    const prepared = await prepareCasterActionOnTarget(
      { ...input, command: args.command },
      {
        caster,
        target: mover,
        movementTargets: args.movementTargets,
        sceneContext: null,
        capability: collisionDamageCapability({
          actorId: caster.id,
          gameSystemId: input.state.gameSystemId,
          sourceId: occurrenceId,
          damageTypeId: collision.damageTypeId,
          diceConfig
        })
      }
    )
    if (prepared.plan.kind !== 'SINGLE_GRAPH')
      throw new Error('A forced-movement collision is one damage graph.')
    const binding = bindings.get(mover.id) ?? prepared.binding
    const [settled] = await executeEncounterActorsAction({
      runtime: input.runtime,
      random: input.random,
      adapter: prepared.adapter,
      plan: prepared.plan,
      occurrenceId: areaOccurrenceId,
      rollsPerTarget: true,
      priorActorIds,
      targets: [{ actorId: mover.id, binding }]
    })
    bindings.set(mover.id, bindingAfterHitPoints(binding, settled!.complete.applications))
    priorActorIds.push(mover.id)
    none.kept.push({ actor: mover, target: { prepared } })
    none.settled.push(settled!)
  }
  for (const [index, entry] of args.struck.entries.entries()) {
    const { actor, target, sealed } = entry
    const [settledSave] = await settleEncounterAreaAction({
      runtime: input.runtime,
      random: input.random,
      adapter: target.prepared.adapter,
      plan: target.prepared.plan,
      occurrenceId: areaOccurrenceId,
      targets: [
        {
          actorId: actor.id,
          occurrenceId: sealed.snapshot.occurrenceId,
          binding: target.prepared.binding,
          currentBinding: bindings.get(actor.id),
          attackSight: target.prepared.attackSight,
          autoRoll: { SOURCE: false, TARGET: false },
          discoverLegendaryResistance: discoverNativeLegendaryResistance(input, target.prepared)
        }
      ],
      tests: [args.struck.tests[index]!],
      legendaryResistance: args.struck.audits,
      rollsPerTarget: true
    })
    bindings.set(
      actor.id,
      bindingAfterHitPoints(
        bindings.get(actor.id) ?? target.prepared.binding,
        settledSave!.complete.applications
      )
    )
    none.struck.kept.push(entry)
    none.struck.settled.push(settledSave!)
  }
  return none
}

/**
 * The commit every multi-creature root shares, whether a point area settled its saves or a list of
 * chosen creatures was resolved at once: each creature's outcome, the caster's single spend (merged
 * into their own outcome when they are also a target), the concentration it breaks, the rules as
 * they stand after it, and the root and child contracts the room persists in one transaction.
 */
export async function completeAreaCommit(args: {
  input: AreaPlanBase
  command: ResolveEncounterActionInputDto
  caster: EncounterRunActorState
  occurredAt: string
  /** What each counter that failed against the cast spends with this commit (D127). */
  failedCounters: Awaited<ReturnType<ReachCastWindow['pause']['planFailedCounters']>>
  /** The effect each creature's used reaction to being chosen leaves on it, by actor id. */
  reactionEffects?: ReadonlyMap<
    string,
    { id: string; plan: Parameters<typeof createNativeActiveEffect>[0] }
  >
  movementTargets: ReadonlyMap<string, MovementTargets>
  kept: readonly { actor: EncounterRunActorState; target: { prepared: AreaPrepared } }[]
  lead: AreaPrepared
  ruleOverrides: ReturnType<typeof reachRuleOverrides>
  actionEconomy:
    | NonNullable<
        Awaited<ReturnType<typeof evaluateNativeLiveActionEconomy>>['economy']
      >['consumption']
    | null
  attackAction: Awaited<ReturnType<typeof evaluateNativeLiveActionEconomy>>['attackAction']
  settled: Awaited<ReturnType<typeof settleEncounterAreaAction>>
  /** Whether each entry of `kept` rolled its own dice (a projectile list) rather than sharing one set. */
  rollsPerTarget: boolean
  /** The settled saves; only a Legendary Resistance audit reads one. */
  tests: readonly Pick<Awaited<ReturnType<typeof replayAreaTargetSave>>, 'actorId' | 'boundary'>[]
  audits: ReturnType<typeof encounterAreaLegendaryResistanceAudits>
  /** The creatures the area's movers struck, with the saves they sealed (none for a list of chosen creatures). */
  struck?: StruckSaves
  areaOccurrenceId: string
  /** The pending area this commit settles; null for a list of chosen creatures that commits at once. */
  areaSnapshot: ServerAggregateChoicePendingSnapshotDto | null
  caughtChecksum: string
  removedActorIds: readonly string[]
  unaffectedActorIds: readonly string[]
  /** The rays random pushes rolled when a pick was first held; a replan keeps them. */
  sealedRays?: readonly { targetActorId: string; ray: ScenePoint }[]
  /** The zone an action leaves at the picked point, with the area it fills. */
  placement: AreaReach['placement']
  /** The creature an action summons at the picked point; its actor and token are written with the cast. */
  summon?: AreaReach['summon']
  occurrenceVersion: number
  response: ResolveRuleOccurrenceInputDto | null
  removal: RemoveAreaTargetInputDto | null
  /** The Creature every kept creature swaps into when the action authors forms (D130). */
  formCreature?: EncounterActorFormCreature | null
}) {
  const {
    input,
    command,
    caster,
    occurredAt,
    failedCounters,
    reactionEffects,
    movementTargets,
    kept: caughtKept,
    lead,
    ruleOverrides,
    actionEconomy,
    attackAction,
    settled: caughtSettled,
    rollsPerTarget,
    tests,
    audits,
    struck = { entries: [], tests: [], audits: new Map() },
    areaOccurrenceId,
    areaSnapshot,
    caughtChecksum,
    removedActorIds,
    unaffectedActorIds,
    sealedRays,
    placement,
    summon,
    occurrenceVersion,
    response,
    removal,
    formCreature
  } = args
  const { actors } = input
  const caughtEntries = encounterChosenActorEntries(
    areaOccurrenceId,
    caughtKept.map(({ actor }) => actor.id)
  )
  const forcedMovements = caughtKept.flatMap(({ actor, target }, index) => {
    const { occurrenceId } = caughtEntries[index]!
    const complete = caughtSettled.find((entry) => entry.occurrenceId === occurrenceId)?.complete
    if (!complete) throw new Error('The area outcome is unavailable.')
    return interpretForcedMovements(target.prepared, {
      execution: complete.execution,
      occurrenceId,
      published: complete.published,
      targetActorId: actor.id,
      random: input.random,
      sealedRays
    })
  })
  // Each mover that travelled 10 feet or more takes its collision damage as one more entry after
  // the caught creatures' (D159).
  const collisions = await settleForcedMovementCollisions({
    input,
    command,
    caster,
    movementTargets,
    areaSnapshot,
    areaOccurrenceId,
    kept: caughtKept,
    settled: caughtSettled,
    struck,
    movements: forcedMovements
  })
  const kept = [...caughtKept, ...collisions.kept, ...collisions.struck.kept]
  const settled = [...caughtSettled, ...collisions.settled, ...collisions.struck.settled]
  const struckStart = caughtKept.length + collisions.kept.length
  // The caster's counters to a counter cast against its cast spend in the caster's one batch with the cast;
  // a kept creature that countered pays its slot in its own first outcome.
  const casterCounterConsumptions = counterConsumptionsOf(failedCounters, caster.id)
  const failedReactorSlots = new Set(
    failedCounters.flatMap(({ receipt, spellConsumption }) =>
      spellConsumption ? [receipt.reaction.reactorActorId] : []
    )
  )
  // The cast ends the caster's effects that end on a cast (Invisibility), and releases the condition
  // each held alone: in the caster's spend batch, or on their first outcome when the area catches them.
  const dispositions = new Map(actors.map(({ id, disposition }) => [id, disposition]))
  const { consumedGrants, sourceReleases } = actionEndedEffects({
    holderActorId: caster.id,
    held: input.activeEffectsByActorId.get(caster.id) ?? [],
    makesAttackRoll: false,
    castsSpell: preparedCastsSpell(lead),
    againstEnemy: actsAgainstEnemy({
      actorId: caster.id,
      targetActorIds: kept.map(({ actor }) => actor.id),
      dispositions
    })
  })
  // A struck creature's save ran under its own collision occurrence, sealed with it.
  const entries = [
    ...encounterChosenActorEntries(
      areaOccurrenceId,
      kept.slice(0, struckStart).map(({ actor }) => actor.id)
    ),
    ...collisions.struck.settled.map(({ actorId, occurrenceId }) => ({ actorId, occurrenceId }))
  ]
  const { maintenance, removedIds, planZones, holdingZone } = await prepareAreaCommitMaintenance({
    input,
    command,
    caster,
    lead,
    movementTargets,
    placement,
    areaOccurrenceId
  })
  const outcomes = await planAreaOutcomes({
    input,
    command,
    caster,
    occurredAt,
    areaOccurrenceId,
    kept,
    settled,
    entries,
    caughtCount: caughtKept.length,
    struckStart,
    tests,
    audits,
    struck,
    reactionEffects,
    formCreature,
    maintenance,
    removedIds,
    holdingZone,
    dispositions,
    consumedGrants,
    sourceReleases,
    casterCounterConsumptions,
    failedReactorSlots,
    discoverResistance: (prepared) => discoverNativeLegendaryResistance(input, prepared)
  })
  const { maintainedState, zoneMaintenanceTransition } = openZoneOnlyMaintenance({
    input,
    command,
    caster,
    placement,
    areaOccurrenceId,
    occurredAt,
    maintenance,
    maintainedState: outcomes.maintainedState
  })
  return settleAreaCommit({
    input,
    command,
    caster,
    occurredAt,
    lead,
    placement,
    summon,
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
    outcomes,
    maintainedState,
    zoneMaintenanceTransition
  })
}

/** The completed area and its per-creature child contracts the room persists in one transaction. */
export function buildNativeLiveEncounterAreaCommitInput(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  plan: Extract<
    Awaited<ReturnType<typeof planNativeLiveEncounterAreaCommit>>,
    { kind: 'AREA_COMMIT' }
  > & {
    dependencies: readonly { request: LiveSessionEncounterRulesRequest }[]
    revisions: LiveSessionRulesRevisions
  }
) {
  const owners = new Map(
    plan.dependencies.flatMap(({ request }) =>
      request.kind === 'MAINTENANCE_OWNER'
        ? [[checksumRuleDocument(request), request] as const]
        : []
    )
  )
  return liveSessionEncounterAreaCommitInputSchema.parse({
    ...scope,
    command: plan.command,
    response: plan.response,
    removal: plan.removal,
    revisions: plan.revisions,
    maintenanceOwners: [...owners.values()],
    maintainedState: plan.maintainedState,
    occurredAt: plan.occurredAt,
    initialDefinitionId: plan.initialDefinitionId,
    execution: plan.execution,
    targets: plan.targets,
    rollsPerTarget: plan.rollsPerTarget,
    area: plan.area,
    unaffectedActorIds: plan.unaffectedActorIds,
    placedZones: plan.placedZones,
    zoneSourceGrant: plan.zoneSourceGrant,
    forcedMovements: plan.forcedMovements,
    summonedTokens: plan.summonedTokens,
    rules: plan.rules,
    resourceConsumption: plan.resourceConsumption,
    itemConsumption: plan.itemConsumption,
    spellConsumption: plan.spellConsumption,
    failedCounters: plan.failedCounters.map(({ receipt, spellConsumption }) => ({
      receipt,
      spellConsumption
    })),
    consumedGrants: plan.consumedGrants,
    label: plan.label,
    ruleOverrides: plan.ruleOverrides,
    concentration: plan.concentration.completed,
    pendingConcentration: plan.concentration.pending,
    concentrationEnds: plan.concentration.concentrationEnds,
    endedGrants: plan.concentration.endedGrants
  })
}
