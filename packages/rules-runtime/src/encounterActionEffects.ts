import { v5 as uuidv5 } from 'uuid'

import {
  prepareEncounterActionEffectPlans,
  prepareRecurringActiveEffect
} from './encounterActionEffectPlans.js'
import type { CharacterRuleActionActiveEffectPlan } from './characterRuleActionSystemAdapter.js'
import { toCharacterInitiativeActorFacts } from './character/characterInitiativeFacts.js'
import { prepareEncounterActionMechanics } from './encounterActionMechanicsPreparation.js'
import { advanceNativeActionGraphs } from './encounterActionExecution.js'
import { encounterAttackActionAttacks } from './encounterAttackAction.js'
import type { EncounterAttackActionTransitionDto } from '@artificer-toolkit/schema/projections/encounterAttackAction'
import { encounterActionSourceLabel } from './encounterActionSources.js'
import { readEncounterActorConditionState } from './encounterCharacterMechanicsBatch.js'
import type { IncomingDamageGrantTrigger } from './encounterEndedEffectRelease.js'
import {
  discoverEncounterFeatureActions,
  type EncounterPassiveWeaponHit
} from './encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { encounterActionReachFeet } from './encounterActionTargetPolicy.js'
import { preparedSpellCastLevel } from './encounterPreparedSpellCast.js'
import { readEncounterChosenItem } from './encounterChosenItem.js'
import { planEncounterEquipmentDegradation } from './encounterEquipmentDegradation.js'
import { planSpatialHeldCondition } from './encounterSpatialHeldCondition.js'
import type { CharacterMovementFacts, MovementTarget } from './encounterMovementTargets.js'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { CompiledActionZonePlacement } from '@artificer-toolkit/schema/projections/characterMechanics'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { hitPointTierCeilings, selectHitPointTierPlan } from './hitPointTiers.js'

type CharacterActionMovementFacts = CharacterMovementFacts & {
  sheetState: Pick<CharacterSheetState, 'resourceUsage' | 'itemUsage'>
}
type PreparedMechanics<TCharacterFacts extends CharacterActionMovementFacts> = Awaited<
  ReturnType<typeof prepareEncounterActionMechanics<TCharacterFacts>>
>
type CompleteExecution = Extract<
  Awaited<ReturnType<typeof advanceNativeActionGraphs>>,
  { kind: 'COMPLETE' }
>

/** The facts an effect plan reads from the creature that will hold the effect. */
function effectTarget(target: MovementTarget<CharacterActionMovementFacts>) {
  return {
    actorId: target.actor.id,
    conditionIds: target.characterFacts
      ? (target.characterFacts.character.state.conditions ?? []).map(
          (condition) => condition.conditionTypeId
        )
      : target.state.conditions,
    effectiveSize: encounterActorEffectiveSize(target),
    lifetimeScope: target.actor.kind === 'CHARACTER' ? ('OWNER' as const) : ('ENCOUNTER' as const),
    activeEffects: target.activeEffects
  }
}

/**
 * The timed grant a placed zone gives the creature that placed it (D153), as an effect on the acting
 * creature. It comes from the zone's own plan rather than from an outcome, so no execution binds it.
 */
export function prepareNativeZoneSourceGrantEffect<
  TCharacterFacts extends CharacterActionMovementFacts
>(input: {
  prepared: PreparedMechanics<TCharacterFacts>
  plan: CharacterRuleActionActiveEffectPlan
  published: CompleteExecution['published']
  occurrenceId: string
  commandId: string
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
}) {
  const { prepared } = input
  const source = prepared.movementTargets.get(prepared.actor.id)
  if (!source || checksumCanonicalJson(source.actor) !== checksumCanonicalJson(prepared.actor))
    throw new Error('Encounter zone placer is stale.')
  const effect = prepareRecurringActiveEffect({
    encounterId: prepared.state.id,
    occurrenceId: input.occurrenceId,
    commandId: input.commandId,
    sourceActorId: prepared.actor.id,
    sourceLabel: encounterActionSourceLabel(prepared.source),
    sourceHidden: !prepared.actor.public,
    currentActorId: prepared.state.currentActorId,
    target: effectTarget(source),
    activeEffectsByActorId: input.activeEffectsByActorId,
    activeEffectPlan: input.plan,
    published: input.published,
    d20: null
  })
  if (!effect) throw new Error('A zone’s placer grant yields no effect.')
  return effect
}

const INCOMING_DAMAGE_GRANT_NAMESPACE = '8c1d4e0a-6b7f-4d2e-9a35-f0e2b7c41d68'

/**
 * The grants a creature gives itself when it takes damage, from its Creature's passive
 * damage-trigger features: each made now as the effect it would hold, for `targetEndedEffects` to
 * select by the damage dealt. A Character holder has no such features. It reads only the holder's
 * stored actor and held effects, so planning and persisting prepare the same triggers.
 */
export function prepareNativeIncomingDamageGrantTriggers(input: {
  encounter: { id: string; currentActorId: string | null }
  holder: EncounterRunActorState
  /** The effects the holder carries before the damage. */
  held: readonly ActiveRuleEffectRecord[]
  occurrenceId: string
  commandId: string
  /** Tells apart the settlements of one occurrence that damage the same creature (Legendary Actions). */
  ordinal?: number | string
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
}): IncomingDamageGrantTrigger[] {
  const { holder } = input
  if (holder.kind !== 'CREATURE') return []
  return discoverEncounterFeatureActions({
    actor: holder,
    conditionDefinitionIds: [],
    abilityDefinitions: [],
    spells: new Map()
  }).passiveDamageGrants.map(({ capability, damageTypeIds, plan }) => {
    const effect = prepareRecurringActiveEffect({
      encounterId: input.encounter.id,
      occurrenceId: input.occurrenceId,
      commandId: input.commandId,
      sourceActorId: holder.id,
      sourceLabel: capability.label,
      sourceHidden: !holder.public,
      currentActorId: input.encounter.currentActorId,
      target: {
        actorId: holder.id,
        conditionIds: readEncounterActorConditionState(holder.conditions ?? []).ids,
        effectiveSize: creatureSnapshotSize(holder),
        lifetimeScope: 'ENCOUNTER',
        activeEffects: input.held
      },
      activeEffectsByActorId: input.activeEffectsByActorId,
      activeEffectPlan: plan,
      published: plan.frozenGraph,
      d20: null
    })
    if (!effect) throw new Error('A passive damage trigger yields no effect.')
    return {
      id: uuidv5(
        `${input.occurrenceId}:${input.ordinal ?? ''}:${holder.id}:${capability.effectId}`,
        INCOMING_DAMAGE_GRANT_NAMESPACE
      ),
      authoredEffectId: capability.effectId,
      damageTypeIds,
      effect
    }
  })
}

/**
 * The active-effect plan an action's capability carries, selected by the definition that ran. An
 * action tiered on hit points carries one plan per tier; the target's current hit points pick it.
 */
export function encounterActiveEffectPlan<TCharacterFacts extends CharacterActionMovementFacts>(
  prepared: PreparedMechanics<TCharacterFacts>,
  published: CompleteExecution['published']
) {
  const plans: readonly CharacterRuleActionActiveEffectPlan[] =
    prepared.source.kind === 'CHARACTER_ACTION'
      ? (prepared.source.entry.compilation.hitPointTierPlans ?? [])
      : (prepared.adapter.activeEffectPlans?.({
          action: prepared.source.capability,
          published
        }) ?? [])
  const tiers =
    prepared.source.kind === 'CHARACTER_ACTION'
      ? (prepared.source.entry.compilation.hitPointTiers ?? [])
      : hitPointTierCeilings(prepared.source.capability.compiledEffect.entries)
  if (tiers.length > 0) {
    const target = prepared.movementTargets.get(prepared.target.id)
    if (!target) throw new Error('Encounter action effect target is stale.')
    return selectHitPointTierPlan(tiers, plans, target.state.current)
  }
  if (prepared.source.kind === 'CHARACTER_ACTION')
    return prepared.source.entry.compilation.activeEffectPlan
  if (plans.length > 1) throw new Error('Encounter action selected multiple active-effect plans.')
  return plans[0] ?? null
}

function creatureSnapshotSize(actor: EncounterRunActorState): string | null {
  const snapshot = actor.snapshot
  const payload =
    snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot.payload : null
  return payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    typeof payload.size === 'string'
    ? payload.size
    : null
}

/** An actor's size now: a Creature's snapshot size, or a Character's effective size from its facts. */
export function encounterActorEffectiveSize(
  target: MovementTarget<CharacterActionMovementFacts>
): string | null {
  if (target.actor.kind !== 'CHARACTER') return creatureSnapshotSize(target.actor)
  const facts = target.characterFacts
  return facts
    ? toCharacterInitiativeActorFacts({
        snapshot: facts.ruleEvaluation.snapshot,
        registry: facts.ruleEvaluation.registry,
        rulePolicyOutput: facts.ruleEvaluation.output
      }).effectiveSize
    : null
}

export function prepareNativeActionEffectsPlan<
  TCharacterFacts extends CharacterActionMovementFacts
>(input: {
  prepared: PreparedMechanics<TCharacterFacts>
  /** The settled graph run; a contest win supplies its own d20 and no applications. */
  execution: Pick<CompleteExecution, 'published' | 'execution' | 'd20' | 'applications'>
  occurrenceId: string
  commandId: string
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  /** The attack's transition on its actor's Attack action, which a gated hold reads. */
  attackAction?: EncounterAttackActionTransitionDto | null
  concealment?: Parameters<typeof prepareEncounterActionEffectPlans>[0]['concealment']
  link?: Parameters<typeof prepareEncounterActionEffectPlans>[0]['link']
  form?: Parameters<typeof prepareEncounterActionEffectPlans>[0]['form']
  /** What triggered a reaction, which its effect may bind. */
  trigger?: { damageTypeIds: readonly string[] }
  /** The target's item the caster chose, for an action used on an item (Shillelagh, Heat Metal). */
  chosenItemInstanceId?: string
  /** The target Creature's passives that wear down the weapon that hits it. */
  weaponHits?: readonly EncounterPassiveWeaponHit[]
  /**
   * The zone the action places when it holds the condition the action's failed save applies
   * (D146): the hold is the creature's effect, under the Concentration the zone depends on.
   */
  holdingZone?: {
    record: Parameters<typeof planSpatialHeldCondition>[0]['zone']
    maintenance: CompiledActionZonePlacement['maintenance']
  }
}) {
  const { prepared, execution } = input
  const plan: CharacterRuleActionActiveEffectPlan | null = encounterActiveEffectPlan(
    prepared,
    execution.published
  )
  const target = prepared.movementTargets.get(prepared.target.id)
  if (!target || checksumCanonicalJson(target.actor) !== checksumCanonicalJson(prepared.target))
    throw new Error('Encounter action effect target is stale.')
  const chosen = readEncounterChosenItem({
    plan: plan?.chosenItem,
    target,
    itemInstanceId: input.chosenItemInstanceId
  })
  // The outcome drops the item only when a hand holds it; a worn one stays (the ruling on Heat Metal).
  const released = Boolean(
    chosen?.releasable &&
    plan?.chosenItem?.releasedOn != null &&
    plan.chosenItem.releasedOn === execution.d20?.resultPath
  )
  // A Creature's attack wears down the target's gear; a Character's own action authors none.
  const degradation =
    'capability' in prepared.source
      ? planEncounterEquipmentDegradation({
          capability: prepared.source.capability,
          resultPath: execution.d20?.resultPath,
          items: target.characterFacts?.ruleEvaluation.snapshot.equipmentItems ?? null,
          chosenItemInstanceId: input.chosenItemInstanceId
        })
      : null
  // A Character's weapon that hits wears down by what the target's passive says; its attacker is the source.
  const attackWeapon =
    prepared.source.kind === 'CHARACTER_ACTION' ? prepared.source.candidate.equipment : undefined
  const hit = execution.d20?.resultPath === 'ON_HIT' || execution.d20?.resultPath === 'ON_CRIT'
  const sourceDegradation =
    attackWeapon && hit && prepared.actor.id !== prepared.target.id
      ? (input.weaponHits ?? [])
          .map(({ capability }) =>
            planEncounterEquipmentDegradation({
              capability,
              resultPath: 'PASSIVE',
              subject: 'ATTACKER_WEAPON',
              items:
                prepared.sourceFacts.characterFacts?.ruleEvaluation.snapshot.equipmentItems ?? null,
              chosenItemInstanceId: attackWeapon.itemInstanceId
            })
          )
          .find((plan) => plan.kind === 'DEGRADE')
      : undefined
  const effects = prepareEncounterActionEffectPlans({
    encounterId: prepared.state.id,
    occurrenceId: input.occurrenceId,
    commandId: input.commandId,
    sourceActorId: prepared.actor.id,
    sourceLabel: encounterActionSourceLabel(prepared.source),
    sourceCharacterId: prepared.actor.kind === 'CHARACTER' ? prepared.actor.sourceId : null,
    sourceHidden: !prepared.actor.public,
    currentActorId: prepared.state.currentActorId,
    target: effectTarget(target),
    activeEffectsByActorId: input.activeEffectsByActorId,
    activeEffectPlan: plan,
    sealedReachFeet: plan?.actorRelationshipContribution
      ? encounterActionReachFeet(prepared.targetPolicy)
      : undefined,
    attacks: input.attackAction ? encounterAttackActionAttacks(input.attackAction) : null,
    concealment: input.concealment,
    link: input.link,
    form: input.form,
    ...(chosen ? { chosenItem: { item: chosen.item, released } } : {}),
    spellCastLevel: preparedSpellCastLevel(prepared) ?? undefined,
    published: execution.published,
    execution: execution.execution,
    d20: execution.d20,
    applications: execution.applications,
    trigger: input.trigger
  })
  const relationship =
    effects.recurringEffect?.definition.stateContributions.some(
      (contribution) => contribution.kind === 'ACTOR_RELATIONSHIP'
    ) ?? false
  const appliedCondition = execution.applications.some(
    (application) =>
      application.kind === 'CONDITION_APPLY' &&
      application.targetActorId === prepared.target.id &&
      (!plan?.conditionContributions?.length ||
        plan.conditionContributions.some(
          ({ conditionId }) => application.conditionId === conditionId
        ))
  )
  const appliedRecurringOutcome =
    !plan?.conditionContributions?.length &&
    execution.applications.some(
      (application) =>
        application.targetActorId === prepared.target.id &&
        application.sourceNodeId === plan?.frozenGraphNodeId &&
        (application.kind === 'HEAL' ||
          application.kind === 'DAMAGE' ||
          application.kind === 'TEMPORARY_HIT_POINTS')
    )
  // A grant, concealment, link, form or deferred recurrence applies no stored state at cast, so its
  // effect exists exactly when its plan does (a concealment plan yields none when its check beats no observer).
  const grant = Boolean(
    plan?.recurrenceDeferred ||
    plan?.modifierGrantContribution ||
    plan?.concealmentContribution ||
    plan?.actorLinkContribution ||
    plan?.creatureFormContribution ||
    plan?.playAbsenceContribution
  )
  const recurringEffect =
    relationship || grant || appliedCondition || appliedRecurringOutcome
      ? effects.recurringEffect
      : null
  // A rider's effect exists exactly when the save failed by its margin and applied its conditions;
  // a source immunity on every target the action meets, or a save's on its success.
  const immunity = plan?.sourceImmunity
  const immune = Boolean(
    immunity &&
    (immunity.appliesTo === 'EVERY_TARGET' || execution.d20?.resultPath === 'ON_SAVE_SUCCESS')
  )
  // A repeat carrier rides the recurring effect on either save result (it is none once the item is released).
  const riderEffects =
    immune || plan?.repeatCarrier
      ? effects.riderEffects
      : effects.riderEffects.map((effect, index) =>
          execution.applications.some(
            (application) =>
              application.kind === 'CONDITION_APPLY' &&
              application.targetActorId === prepared.target.id &&
              plan?.marginRiders[index]?.conditionContributions.some(
                ({ conditionId }) => application.conditionId === conditionId
              )
          )
            ? effect
            : null
        )
  const { holdingZone } = input
  if (holdingZone && plan) throw new Error('A zone holds its condition alone.')
  const hold =
    holdingZone &&
    planSpatialHeldCondition({
      zone: holdingZone.record,
      holder: effectTarget(target),
      applications: execution.applications,
      encounterId: prepared.state.id,
      occurrenceId: input.occurrenceId,
      sourceCommandId: input.commandId,
      targetActorId: prepared.target.id
    })
  return {
    ...effects,
    recurringEffect:
      recurringEffect ?? (hold ? { definition: hold.definition, lifecycle: hold.lifecycle } : null),
    riderEffects,
    /** The target's item the outcome drops; absent when it drops none. */
    releasedItemInstanceId: released ? chosen?.item.itemInstanceId : undefined,
    /** The worn item the outcome corrodes; absent when it corrodes none. */
    degradedItem: degradation?.kind === 'DEGRADE' ? degradation : undefined,
    /** The weapon the source hit with that the target's passive corrodes; absent when it corrodes none. */
    sourceDegradedItem: sourceDegradation?.kind === 'DEGRADE' ? sourceDegradation : undefined,
    // A source immunity outlasts the Concentration its action's effect depends on.
    riderMaintained: !immune,
    maintenance: recurringEffect
      ? (plan?.maintenance ?? null)
      : hold
        ? holdingZone.maintenance
        : null
  }
}
