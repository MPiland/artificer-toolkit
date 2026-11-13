import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { createLinkedRiders } from '@artificer-toolkit/rules-runtime/encounterActionEffectPlans'
import { projectNativeActionEffectTransitions } from '@artificer-toolkit/rules-runtime/encounterActionEffectReceipts'
import type { prepareNativeActionEffectsPlan } from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import {
  planNativeEncounterActionMechanics,
  type NativeEncounterActionMechanicsInput
} from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import { isMeleeAttackSource } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { actorFormEntry } from '@artificer-toolkit/encounter-persistence/actorFormPersistence'
import type { EncounterActorFormCreature } from '@artificer-toolkit/rules-runtime/encounterActorForm'
import type { encounterTargetLegendaryResistance } from '@artificer-toolkit/rules-runtime/encounterAreaLegendaryResistance'
import { withFeatureChargeUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { targetEndedEffects } from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import type { PreparedLiveCharacterSheet } from './nativeCharacterRules.js'
import { createNativeActiveEffect, nativeEffectOwner } from './nativeEncounterSettlement.js'

type EffectsPlan = ReturnType<typeof prepareNativeActionEffectsPlan<PreparedLiveCharacterSheet>>
type PlannedEffect = {
  id: string
  plan: NonNullable<EffectsPlan['stateEffect']>
}
type EndedEffectsInput = Parameters<typeof targetEndedEffects>[0]

/**
 * Plans one target's outcome of an action: the effects the outcome ends on the target, the effects
 * it creates there, the target's mechanics and what the target itself spends with them. A
 * single-target action plans its one outcome here, and a chosen list or an area plans each entry's,
 * so anything a target pays or gains with its outcome is added here once.
 */
export function planNativeActionTargetOutcome(input: {
  /** The action against this target as the outcome finds it; its source's spend is settled when the outcome carries one. */
  prepared: Awaited<ReturnType<typeof prepareEncounterActionMechanics<PreparedLiveCharacterSheet>>>
  /** The d20 evidence the action settled for the target. */
  testEvidence: EndedEffectsInput['testEvidence']
  occurrenceId: string
  /** The command the target's own mechanics settle under. */
  commandId: string
  sourceCommandId: string
  occurredAt: string
  userId: string
  effects: EffectsPlan
  applications: NativeEncounterActionMechanicsInput['applications']
  /** The target's effects the outcome may end: those no earlier outcome or spend ended. */
  held: EndedEffectsInput['held']
  grantTriggers: EndedEffectsInput['grantTriggers']
  damagerActorId: string
  dispositions: EndedEffectsInput['dispositions']
  /** The effects the target holds as the outcome lands; the effects it creates join them. */
  currentEffects: ActiveRuleEffectRecord[]
  /** The id the lasting effect takes when its applications already name it (D156). */
  recurringEffectId?: string
  /** The maintained state the outcome's lasting effect and maintained riders depend on. */
  maintainedState: { id: string } | null
  /** The effect of a reaction the target used, which lands after the action's own effects. */
  reactionEffect: PlannedEffect | null
  /** Timed grants the action gives the target beside those its damage triggers make. */
  grants: readonly PlannedEffect[]
  /** The creature the lasting effect turns the target into. */
  formCreature: EncounterActorFormCreature | null
  /** The target spends something of its own with the outcome, so its Character versions. */
  targetSpends: boolean
  /** The Legendary Resistance charge the target used against the outcome. */
  charge: NonNullable<ReturnType<typeof encounterTargetLegendaryResistance>>['charge'] | null
  /** The reaction allowance the target spent against the outcome. */
  reactionEconomy: Parameters<typeof consumeEncounterActionEconomy>[0]['consumption'] | null
  /** The source's and the target's other writes that ride the same mechanics. */
  mechanics: Pick<
    NativeEncounterActionMechanicsInput,
    | 'sourceSpend'
    | 'sourceReleases'
    | 'targetReleases'
    | 'damageReleases'
    | 'releaseTargetItemInstanceId'
    | 'degradeTargetItem'
    | 'degradeSourceItem'
  >
}) {
  const { prepared, effects, occurredAt } = input
  const { state, target } = prepared
  const damageEnded = targetEndedEffects({
    holderActorId: target.id,
    held: input.held,
    attack: prepared.makesAttackRoll
      ? { melee: isMeleeAttackSource(state.gameSystemId, prepared.source) }
      : null,
    testEvidence: input.testEvidence,
    turnActorId: state.currentActorId,
    applications: input.applications,
    damagerActorId: input.damagerActorId,
    dispositions: input.dispositions,
    grantTriggers: input.grantTriggers
  })
  const effectInput = {
    owner: nativeEffectOwner(target, state.id),
    currentEffects: input.currentEffects,
    occurredAt
  }
  const stateEffect =
    effects.stateEffect && createNativeActiveEffect(effects.stateEffect, effectInput)
  const recurringEffect =
    effects.recurringEffect &&
    createNativeActiveEffect(effects.recurringEffect, {
      ...effectInput,
      maintainedEffectStateId: input.maintainedState?.id,
      id: input.recurringEffectId
    })
  const riderEffects = createLinkedRiders(
    effects.riderEffects,
    recurringEffect,
    (plan) =>
      plan &&
      createNativeActiveEffect(plan, {
        ...effectInput,
        maintainedEffectStateId: effects.riderMaintained ? input.maintainedState?.id : undefined
      })
  )
  const create = ({ id, plan }: PlannedEffect) =>
    createNativeActiveEffect(plan, { ...effectInput, id })
  const reactionEffect = input.reactionEffect && create(input.reactionEffect)
  // The target's own passive damage triggers make timed grants on it after its other effects.
  const grantEffects = [
    ...damageEnded.grants.map(({ id, effect }) => ({ id, plan: effect })),
    ...input.grants
  ].map(create)
  const createdEffects = [
    stateEffect,
    recurringEffect,
    ...riderEffects,
    reactionEffect,
    ...grantEffects
  ].flatMap((effect) => (effect ? [effect] : []))
  const enterForm =
    recurringEffect && input.formCreature
      ? actorFormEntry(recurringEffect, input.formCreature)
      : undefined
  const planned = planNativeEncounterActionMechanics(
    {
      prepared,
      encounterId: state.id,
      expectedEncounterVersion: state.version,
      occurrenceId: input.occurrenceId,
      sourceCommandId: input.sourceCommandId,
      commandId: input.commandId,
      occurredAt,
      applications: input.applications,
      grantedMaximumHitPoints: effects.hitPointMaximumRaise,
      forceTargetVersionAdvance:
        target.kind === 'CHARACTER' && (createdEffects.length > 0 || input.targetSpends),
      ...input.mechanics,
      damageReleases: [...damageEnded.releases, ...(input.mechanics.damageReleases ?? [])],
      ...(enterForm ? { enterForm } : {})
    },
    input.userId
  )
  // A Legendary Resistance the target used spends its own charge, and a reaction its allowance,
  // with the outcome.
  const { charge, reactionEconomy } = input
  const spent = (actor: EncounterRunActorState) => {
    const charged = charge
      ? encounterRunActorStateSchema.parse({
          ...actor,
          resources: withFeatureChargeUsed(actor, charge.ownerFeatureId, charge.afterUsed)
        })
      : actor
    return reactionEconomy
      ? consumeEncounterActionEconomy({
          actor: charged,
          consumption: reactionEconomy,
          overridden: false
        })
      : charged
  }
  const transition = (effect: ActiveRuleEffectRecord | null) =>
    projectNativeActionEffectTransitions({
      state: null,
      recurring: effect,
      targetActorId: target.id
    }).activeEffectTransitions
  return {
    damageEnded,
    createdEffects,
    mechanics: {
      ...planned,
      mechanics: { ...planned.mechanics, updatedActor: spent(planned.mechanics.updatedActor) },
      settledSource:
        planned.settledSource.id === target.id
          ? spent(planned.settledSource)
          : planned.settledSource
    },
    effectTransitions: projectNativeActionEffectTransitions({
      state: stateEffect,
      recurring: recurringEffect,
      riders: riderEffects,
      targetActorId: target.id
    }),
    reactionEffectTransitions: transition(reactionEffect),
    grantEffectTransitions: grantEffects.flatMap(transition)
  }
}
