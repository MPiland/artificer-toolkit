import { type ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { EncounterSettledIncomingGateDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import { type EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  encounterAreaLegendaryResistanceAudits,
  encounterTargetLegendaryResistance
} from '@artificer-toolkit/rules-runtime/encounterAreaLegendaryResistance'
import { settleEncounterAreaAction } from '@artificer-toolkit/rules-runtime/encounterAreaActionExecution'
import { encounterAreaTargetCommandId } from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import type { EncounterActorFormCreature } from '@artificer-toolkit/rules-runtime/encounterActorForm'
import {
  prepareNativeActionEffectsPlan,
  prepareNativeIncomingDamageGrantTriggers
} from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import { effectsAfterEnding } from '@artificer-toolkit/rules-runtime/encounterEffectOnEnd'
import {
  buildEncounterJoinedMaintenanceTransition,
  buildEncounterMaintenanceTransition
} from '@artificer-toolkit/rules-runtime/encounterActionMaintenance'
import { planNativeActionTargetOutcome } from './nativeActionTargetOutcome.js'
import type { planNativeEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import { buildEncounterActionStoredExecution } from '@artificer-toolkit/rules-runtime/encounterActionReceipt'
import type { actionEndedEffects } from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import { projectEncounterActionTarget } from '@artificer-toolkit/rules-runtime/encounterActionProjection'
import { findEncounterFeatureResource } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { prepareNativeLiveMaintainedState } from './nativeEncounterMaintenance.js'
import { windowSpentEffects } from '@artificer-toolkit/rules-runtime/encounterD20Window'
import type { AreaPlanBase, AreaPrepared } from './nativeAreaPreparation.js'
import type {
  StruckSaves,
  discoverNativeLegendaryResistance,
  replayAreaTargetSave
} from './nativeAreaRevalidation.js'
import type { prepareAreaCommitMaintenance } from './nativeAreaCommitMaintenance.js'

/**
 * The prepared action against a creature as its next entry in the same list finds it: the hit points
 * and Character record its earlier entry's plan left.
 */
function advanceAreaPrepared(
  prepared: AreaPrepared,
  plan: ReturnType<typeof planNativeEncounterActionMechanics>['targetPlan'],
  occurredAt: string
): AreaPrepared {
  const targetFacts = projectEncounterActionTarget({
    target: prepared.targetFacts,
    actor: plan.updatedActor,
    plan,
    campaignId: prepared.state.campaignId,
    gameSystemId: prepared.state.gameSystemId,
    occurredAt
  })
  return {
    ...prepared,
    target: plan.updatedActor,
    targetFacts,
    movementTargets: new Map(prepared.movementTargets).set(plan.updatedActor.id, targetFacts),
    binding: {
      ...prepared.binding,
      currentHitPoints: targetFacts.state.current,
      temporaryHitPoints: targetFacts.state.temporary
    }
  }
}

/**
 * Plans each creature's outcome in an area commit, in entry order: its effects, the one maintained
 * state the first maintaining outcome creates and later ones join, the damage-ended effects, the
 * mechanics, any Legendary Resistance audit and the stored execution.
 */
export async function planAreaOutcomes(args: {
  input: AreaPlanBase
  command: ResolveEncounterActionInputDto
  caster: EncounterRunActorState
  /** The cast's lead, holding every spend the cast settled (D208). */
  lead: AreaPrepared
  occurredAt: string
  areaOccurrenceId: string
  kept: readonly { actor: EncounterRunActorState; target: { prepared: AreaPrepared } }[]
  settled: Awaited<ReturnType<typeof settleEncounterAreaAction>>
  /** The occurrence id each entry of `kept` settled under. */
  entries: readonly { actorId: string; occurrenceId: string }[]
  /** How many leading entries are the cast's own caught creatures; the rest are movers, then the struck. */
  caughtCount: number
  /** The incoming gate each kept caught entry passed, in order; the sealed ray's own record. */
  passedGates: readonly (EncounterSettledIncomingGateDto | undefined)[]
  struckStart: number
  tests: readonly Pick<Awaited<ReturnType<typeof replayAreaTargetSave>>, 'actorId' | 'boundary'>[]
  audits: ReturnType<typeof encounterAreaLegendaryResistanceAudits>
  struck: StruckSaves
  formCreature?: EncounterActorFormCreature | null
  maintenance: Awaited<ReturnType<typeof prepareAreaCommitMaintenance>>['maintenance']
  holdingZone: Parameters<typeof prepareNativeActionEffectsPlan>[0]['holdingZone']
  dispositions: ReadonlyMap<string, EncounterRunActorState['disposition']>
  consumedGrants: ReturnType<typeof actionEndedEffects>['consumedGrants']
  sourceReleases: ReturnType<typeof actionEndedEffects>['sourceReleases']
  discoverResistance: (
    prepared: AreaPrepared
  ) => ReturnType<typeof discoverNativeLegendaryResistance>
}) {
  const {
    input,
    command,
    caster,
    lead,
    occurredAt,
    areaOccurrenceId,
    kept,
    settled,
    entries,
    caughtCount,
    passedGates,
    struckStart,
    tests,
    audits,
    struck,
    formCreature,
    maintenance,
    holdingZone,
    dispositions,
    consumedGrants,
    sourceReleases,
    discoverResistance
  } = args
  const { state } = input
  const userId = input.initial.expectedUserId
  const children = []
  const createdEffects = new Map<string, ActiveRuleEffectRecord[]>()
  // Damage an outcome deals ends the effects its target holds that end on damage; a creature named
  // again keeps what an earlier entry ended ended.
  const damageEndedEffects = new Map<string, ActiveRuleEffectRecord>()
  let maintainedState: ReturnType<typeof prepareNativeLiveMaintainedState> | null = null
  let maintenanceCarried = false
  // A creature named again meets the hit points and Character record its earlier entries left it.
  const advanced = new Map<string, AreaPrepared>()
  for (const [index, { actor, target }] of kept.entries()) {
    const earlier = advanced.get(actor.id)
    // Each entry runs its own action on the hit points and Character record its earlier entries left.
    const prepared = earlier
      ? {
          ...target.prepared,
          target: earlier.target,
          targetFacts: earlier.targetFacts,
          movementTargets: earlier.movementTargets,
          binding: earlier.binding
        }
      : target.prepared
    const { occurrenceId } = entries[index]!
    const complete = settled.find((entry) => entry.occurrenceId === occurrenceId)?.complete
    if (!complete) throw new Error('The area outcome is unavailable.')
    const commandId = encounterAreaTargetCommandId(occurrenceId)
    const effects = prepareNativeActionEffectsPlan({
      prepared,
      execution: complete,
      occurrenceId,
      commandId,
      activeEffectsByActorId: input.activeEffectsByActorId,
      link: { memberActorIds: [...new Set(kept.map((entry) => entry.actor.id))] },
      ...(formCreature ? { form: { creatureId: formCreature.sourceId } } : {}),
      holdingZone
    })
    if (effects.maintenance)
      maintainedState ??= prepareNativeLiveMaintainedState({
        completedPolicy: effects.maintenance,
        maintenance,
        encounterId: state.id,
        ownerActorId: caster.id,
        actionId: command.actionId,
        sourceOccurrenceId: areaOccurrenceId,
        occurredAt
      })
    const joined = effects.maintenance ? maintainedState : null
    // A creature named again meets the effects its earlier entries left it.
    const earlierEffects = createdEffects.get(actor.id) ?? []
    const heldEffects = input.activeEffectsByActorId.get(actor.id) ?? []
    const targetEffects = [
      ...(joined
        ? effectsAfterEnding(heldEffects, maintenance?.removed ?? [], occurredAt)
        : heldEffects),
      ...earlierEffects
    ]
    const applications = [...complete.applications, ...effects.relationshipConditionApplications]
    // A die the creature's d20 window spent on its save is used up with the action.
    for (const spent of windowSpentEffects(complete, input.activeEffectsByActorId, [actor]))
      damageEndedEffects.set(spent.id, spent)
    // Only the cast's own entries and the creatures its movers struck made the saves a Legendary
    // Resistance audit answers.
    const isStruck = index >= struckStart
    const audit =
      index < caughtCount
        ? audits.get(actor.id)
        : isStruck
          ? struck.audits.get(actor.id)
          : undefined
    let resistance: ReturnType<typeof encounterTargetLegendaryResistance> | null = null
    if (audit) {
      const test = (isStruck ? struck.tests : tests).find((entry) => entry.actorId === actor.id)
      if (!test) throw new Error('The area outcome is unavailable.')
      const candidate = await discoverResistance(prepared)()
      const resource =
        candidate &&
        findEncounterFeatureResource(
          prepared.actorRules,
          candidate.targetActorId,
          candidate.ownerFeatureId
        )
      if (!candidate || !resource) throw new Error('Legendary Resistance evidence is stale.')
      resistance = encounterTargetLegendaryResistance({
        audit,
        candidate,
        boundary: test.boundary,
        currentFeatureResource: resource
      })
    }
    // A Character caster caught by their own area spends in the same Sheet write as their first outcome.
    const carriesSpend =
      caster.kind === 'CHARACTER' && actor.id === caster.id && !advanced.has(actor.id)
    const outcome = planNativeActionTargetOutcome({
      // The caster's own outcome pays what the cast settled, a damage reroll included (D208).
      prepared: carriesSpend
        ? { ...prepared, characterActionState: lead.characterActionState }
        : prepared,
      testEvidence: [complete.d20, complete.nestedD20],
      occurrenceId,
      commandId,
      sourceCommandId: command.commandId,
      occurredAt,
      userId,
      effects,
      applications,
      held: (input.activeEffectsByActorId.get(actor.id) ?? []).filter(
        ({ id }) => !damageEndedEffects.has(id) && !consumedGrants.some((ended) => ended.id === id)
      ),
      grantTriggers: prepareNativeIncomingDamageGrantTriggers({
        encounter: state,
        holder: prepared.target,
        held: prepared.targetFacts.activeEffects,
        occurrenceId,
        commandId,
        ordinal: index,
        activeEffectsByActorId: input.activeEffectsByActorId
      }),
      damagerActorId: caster.id,
      dispositions,
      currentEffects: targetEffects,
      maintainedState: joined,
      grants: [],
      formCreature: formCreature ?? null,
      targetSpends: false,
      charge: resistance?.charge ?? null,
      reactionEconomy: null,
      mechanics: carriesSpend
        ? { sourceSpend: 'WITH_OUTCOME', sourceReleases }
        : { sourceSpend: 'NONE' }
    })
    const { mechanics, createdEffects: created, effectTransitions } = outcome
    for (const ended of outcome.damageEnded.endedEffects) damageEndedEffects.set(ended.id, ended)
    const createdDependentEffectIds = effectTransitions.activeEffectTransitions.map(
      (effect) => effect.activeEffectId
    )
    const maintenanceTransition =
      joined && maintenance
        ? maintenanceCarried
          ? buildEncounterJoinedMaintenanceTransition({
              createdState: joined,
              createdDependentEffectIds
            })
          : buildEncounterMaintenanceTransition({
              maintenance,
              createdState: joined,
              createdDependentEffectIds
            })
        : null
    if (joined) maintenanceCarried = true
    createdEffects.set(actor.id, [...earlierEffects, ...created])
    if (kept.some((later, laterIndex) => laterIndex > index && later.actor.id === actor.id))
      advanced.set(actor.id, advanceAreaPrepared(prepared, mechanics.targetPlan, occurredAt))
    children.push({
      actorId: actor.id,
      occurrenceId,
      carriesSpend,
      complete,
      mechanics,
      createdEffects: created,
      resistance,
      execution: buildEncounterActionStoredExecution({
        prepared,
        execution: complete,
        occurrenceId,
        occurrenceVersion: 0,
        settled: mechanics,
        effects: effectTransitions,
        maintainedState: joined,
        maintenanceTransition,
        actionEconomy: null,
        attackAction: null,
        area: { parentOccurrenceId: areaOccurrenceId },
        passedGate: index < caughtCount ? (passedGates[index] ?? null) : null,
        resistance,
        grantEffectTransitions: outcome.grantEffectTransitions
      })
    })
  }
  return { children, createdEffects, damageEndedEffects, maintainedState }
}
