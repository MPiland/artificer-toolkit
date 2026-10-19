import {
  prepareEncounterActionEffectPlans,
  prepareRecurringActiveEffect
} from './encounterActionEffectPlans.js'
import type { CharacterRuleActionActiveEffectPlan } from './characterRuleActionSystemAdapter.js'
import { toCharacterInitiativeActorFacts } from './character/characterInitiativeFacts.js'
import { prepareEncounterActionMechanics } from './encounterActionMechanicsPreparation.js'
import { advanceNativeActionGraphs } from './encounterActionExecution.js'
import { encounterActionSourceLabel } from './encounterActionSources.js'
import { encounterActionReachFeet } from './encounterActionTargetPolicy.js'
import { readEncounterChosenItem } from './encounterChosenItem.js'
import { planSpatialHeldCondition } from './encounterSpatialHeldCondition.js'
import type { CharacterMovementFacts, MovementTarget } from './encounterMovementTargets.js'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { CompiledActionZonePlacement } from '@artificer-toolkit/schema/projections/characterMechanics'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

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

/** The active-effect plan an action's capability carries, selected by the definition that ran. */
export function encounterActiveEffectPlan<TCharacterFacts extends CharacterActionMovementFacts>(
  prepared: PreparedMechanics<TCharacterFacts>,
  published: CompleteExecution['published']
) {
  if (prepared.source.kind === 'CHARACTER_ACTION')
    return prepared.source.entry.compilation.activeEffectPlan
  const plans =
    prepared.adapter.activeEffectPlans?.({
      action: prepared.source.capability,
      published
    }) ?? []
  if (plans.length > 1) throw new Error('Encounter action selected multiple active-effect plans.')
  return plans[0] ?? null
}

/** An actor's size now: a Creature's snapshot size, or a Character's effective size from its facts. */
export function encounterActorEffectiveSize(
  target: MovementTarget<CharacterActionMovementFacts>
): string | null {
  if (target.actor.kind !== 'CHARACTER') {
    const snapshot = target.actor.snapshot
    const payload =
      snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot.payload : null
    return payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload) &&
      typeof payload.size === 'string'
      ? payload.size
      : null
  }
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
  concealment?: Parameters<typeof prepareEncounterActionEffectPlans>[0]['concealment']
  link?: Parameters<typeof prepareEncounterActionEffectPlans>[0]['link']
  form?: Parameters<typeof prepareEncounterActionEffectPlans>[0]['form']
  /** What triggered a reaction, which its effect may bind. */
  trigger?: { damageTypeIds: readonly string[] }
  /** The target's item the caster chose, for an action used on an item (Shillelagh, Heat Metal). */
  chosenItemInstanceId?: string
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
    concealment: input.concealment,
    link: input.link,
    form: input.form,
    ...(chosen ? { chosenItem: { item: chosen.item, released } } : {}),
    published: execution.published,
    execution: execution.execution,
    d20: execution.d20,
    applications: execution.applications,
    trigger: input.trigger
  })
  const relationship =
    effects.recurringEffect?.definition.schemaVersion === 2 &&
    effects.recurringEffect.definition.stateContributions.some(
      (contribution) => contribution.kind === 'ACTOR_RELATIONSHIP'
    )
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
    plan?.creatureFormContribution
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
  const riderEffect =
    immune ||
    execution.applications.some(
      (application) =>
        application.kind === 'CONDITION_APPLY' &&
        application.targetActorId === prepared.target.id &&
        plan?.marginRider?.conditionContributions.some(
          ({ conditionId }) => application.conditionId === conditionId
        )
    )
      ? effects.riderEffect
      : null
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
    riderEffect,
    /** The target's item the outcome drops; absent when it drops none. */
    releasedItemInstanceId: released ? chosen?.item.itemInstanceId : undefined,
    // A source immunity outlasts the Concentration its action's effect depends on.
    riderMaintained: !immune,
    maintenance: recurringEffect
      ? (plan?.maintenance ?? null)
      : hold
        ? holdingZone.maintenance
        : null
  }
}
