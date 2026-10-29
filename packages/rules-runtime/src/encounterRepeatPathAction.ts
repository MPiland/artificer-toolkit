import type { RepeatOfferOrigin } from '@artificer-toolkit/schema/effects/effectOffer'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { compileEffect } from '@artificer-toolkit/shared/compilers'

import { normalizeCharacterActionMechanicFacts } from './character/characterActionRuleFacts.js'
import type { EffectActionCapabilityDescriptor } from './characterActionCapabilityDiscovery.js'
import type { NativeEncounterActionSource } from './encounterActionSources.js'
import {
  decoyStrikeEffects,
  type DecoyStrikeEffects,
  type EncounterAttackDecoy
} from './encounterAttackDecoys.js'
import { resolveEffectOffer, type LiveEffectOffer } from './encounterEffectOffers.js'
import { bindEncounterEffect } from './encounterFeatureActionCapabilityDiscovery.js'

/**
 * The server-only capability of a repeat a held effect offers its source (D166): the paths of the
 * cast, run again against the creature that holds the effect, at the DC and cast level the cast froze.
 */
export interface EncounterRepeatPathCapabilityDescriptor extends EffectActionCapabilityDescriptor {
  kind: 'REPEAT_PATH'
  encounterActorId: string
  /** The held effect that carries the offer, and the offer's place in it. */
  carrierEffectId: string
  offerIndex: number
  /** The creature the repeat runs against: the one that holds the carrier. */
  holderActorId: string
  /** HOLDER (default) runs against the holder; INVOCATION against the targets the repeated invocation picks. */
  target: 'HOLDER' | 'INVOCATION'
  /** The attack bonus an attack repeat rolls with, frozen by the cast; its roll mode starts normal. */
  attackMechanic: { attackBonus: number; rollMode: 'NORMAL' } | null
  /** The damage each outcome resolves to, by outcome id, frozen by the cast (D166). */
  damageExpressions?: Readonly<Record<string, string>>
  label: string
}

const ACTION_ID_SEPARATOR = ':REPEAT_PATH:'

/** The identity of one repeat offer of one actor (the `actionId` of RESOLVE_ACTION). */
export function repeatPathActionId(actorId: string, effectId: string, offerIndex: number): string {
  return `${actorId}${ACTION_ID_SEPARATOR}${effectId}:${offerIndex}`
}

/** The carrier effect and offer a repeat action id names; null for any other id. */
export function parseRepeatPathActionId(actorId: string, actionId: string) {
  if (!actionId.startsWith(`${actorId}${ACTION_ID_SEPARATOR}`)) return null
  const [effectId, index, ...rest] = actionId
    .slice(actorId.length + ACTION_ID_SEPARATOR.length)
    .split(':')
  const offerIndex = Number(index)
  if (!effectId || rest.length > 0 || !Number.isInteger(offerIndex) || offerIndex < 0) return null
  return { effectId, offerIndex }
}

/**
 * The actor a repeat offer is measured from, for its range and reach: the actor that takes it, or for
 * a CONJURED offer the Run actor its carrier conjured (whose owner names the actor and the carrier).
 * Null when that creature is gone, which makes the repeat stale.
 */
export function repeatOfferOriginActorId(input: {
  actorId: string
  offer: Pick<LiveEffectOffer, 'effectId'> & { origin?: RepeatOfferOrigin }
  actors: readonly Pick<EncounterRunActorState, 'id' | 'owner'>[]
}): string | null {
  if (input.offer.origin !== 'CONJURED') return input.actorId
  return (
    input.actors.find(
      ({ owner }) =>
        owner?.ownerActorId === input.actorId && owner.sourceEffectId === input.offer.effectId
    )?.id ?? null
  )
}

/**
 * The actor whose token an action's range is measured from: its own actor, unless the action is a
 * CONJURED repeat (the creature its carrier conjured). A repeat that is stale throws.
 */
export function encounterActionOriginActorId(input: {
  actorId: string
  actionId: string
  actors: readonly Pick<EncounterRunActorState, 'id' | 'owner'>[]
  effectsByHolder: Parameters<typeof resolveEffectOffer>[0]['effectsByHolder']
}): string {
  const parsed = parseRepeatPathActionId(input.actorId, input.actionId)
  if (!parsed) return input.actorId
  const offer = resolveEffectOffer({
    actorId: input.actorId,
    effectsByHolder: input.effectsByHolder,
    zeroHitPointActorIds: new Set(),
    ...parsed,
    kind: 'REPEAT_SOURCE_PATH'
  })
  const originActorId = repeatOfferOriginActorId({
    actorId: input.actorId,
    offer,
    actors: input.actors
  })
  if (originActorId === null) throw new Error('The selected repeat action is stale.')
  return originActorId
}

/**
 * What a settled action spends of the counted uses its effects hold: a hit on a decoy destroys it
 * (`decoyStrikeEffects`), and a repeat spends one of its carrier's uses (`lifecycle.uses`,
 * Goodberry's berries), the last of which ends the carrier. A carrier with no count spends nothing.
 */
export function settledCountedUseSpend(
  action: {
    attackDecoy?: Pick<EncounterAttackDecoy, 'effect' | 'remaining'> | null
    source: NativeEncounterActionSource
  },
  resultPath: string | null | undefined,
  effectsByHolder: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
): DecoyStrikeEffects {
  const decoy = decoyStrikeEffects(action.attackDecoy, resultPath)
  const capability = action.source.kind === 'REPEAT_PATH' ? action.source.capability : null
  const carrier = capability
    ? effectsByHolder
        .get(capability.holderActorId)
        ?.find(({ id }) => id === capability.carrierEffectId)
    : undefined
  const remaining = carrier?.lifecycle.remainingUses
  if (!carrier || remaining === undefined) return decoy
  return remaining <= 1
    ? { ...decoy, endedGrants: [...decoy.endedGrants, carrier] }
    : { ...decoy, spentUseGrants: [...decoy.spentUseGrants, carrier] }
}

/**
 * The once-per-turn key the free use of a `FREE_ONCE` repeat offer spends now (D190a), or null when a
 * use costs the offer's activation: the use is free only in the Run turn the cast was made, only while
 * that turn runs (between turns no key is spent), and only until its key is spent. The offer goes only
 * to its source, so only the caster ever takes it.
 */
export function repeatOfferFreeUseKey(input: {
  offer: Pick<LiveEffectOffer, 'effectId' | 'offerIndex'> & { castTurnSequence?: number }
  turn: Pick<EncounterRunState, 'turnSequence' | 'currentActorId'>
  spentKeys: readonly string[]
}): string | null {
  const key = `repeat-free:${input.offer.effectId}:${input.offer.offerIndex}`
  return input.offer.castTurnSequence === input.turn.turnSequence &&
    input.turn.currentActorId !== null &&
    !input.spentKeys.includes(key)
    ? key
    : null
}

/**
 * The repeat a repeat action id names, read from the effects held now: an ended carrier or an offer
 * that no longer exists makes the id stale. The capability compiles the offer's frozen Effect like any
 * authored action, so the repeat runs through the normal pipeline; a free cast-turn use is charged as
 * a `FREE` activation that spends `freeUseKey` instead.
 */
export function discoverEncounterRepeatPath(input: {
  actorId: string
  actionId: string
  gameSystemId: string
  effectsByHolder: Parameters<typeof resolveEffectOffer>[0]['effectsByHolder']
  turn: Parameters<typeof repeatOfferFreeUseKey>[0]['turn']
  /** The once-per-turn keys the actor has spent this turn. */
  spentKeys: readonly string[]
  conditionDefinitionIds: readonly string[]
  abilityDefinitions: readonly { id: string; code: string }[]
}) {
  const parsed = parseRepeatPathActionId(input.actorId, input.actionId)
  if (!parsed) throw new Error('The selected repeat action is stale.')
  const offer = resolveEffectOffer({
    actorId: input.actorId,
    effectsByHolder: input.effectsByHolder,
    zeroHitPointActorIds: new Set(),
    ...parsed,
    kind: 'REPEAT_SOURCE_PATH'
  })
  const compiledEffect = compileEffect(offer.effect)
  const normalized = bindEncounterEffect({
    gameSystemId: input.gameSystemId,
    compiledEffect,
    conditionDefinitionIds: input.conditionDefinitionIds,
    abilityDefinitions: input.abilityDefinitions
  })
  if (normalized === null) throw new Error('The selected repeat action is stale.')
  const carrier = input.effectsByHolder
    .get(offer.holderActorId)
    ?.find((effect) => effect.id === offer.effectId)
  const grant = carrier?.definition.stateContributions.find(
    (contribution) => contribution.kind === 'MODIFIER_GRANT'
  )
  if (!grant) throw new Error('The selected repeat action is stale.')
  const freeUseKey = repeatOfferFreeUseKey({
    offer,
    turn: input.turn,
    spentKeys: input.spentKeys
  })
  const mechanicFacts = normalizeCharacterActionMechanicFacts(compiledEffect)
  const { invocation } = mechanicFacts
  const capability: EncounterRepeatPathCapabilityDescriptor = {
    kind: 'REPEAT_PATH',
    gameSystemId: input.gameSystemId,
    authoredRootKind: 'effect',
    entryPointDefinitionId: offer.effect.id,
    effectId: offer.effect.id,
    actionId: input.actionId,
    sourceId: offer.effectId,
    label: grant.sourceLabel,
    mechanicFacts:
      freeUseKey === null
        ? mechanicFacts
        : {
            ...mechanicFacts,
            invocation: {
              ...invocation,
              activation: { ...invocation.activation, code: 'FREE', amount: 1 }
            }
          },
    conditionDefinitionIds: normalized.conditionDefinitionIds ?? input.conditionDefinitionIds,
    savingThrowAbilityDefinitionId: normalized.savingThrowAbilityDefinitionId ?? null,
    compiledEffect,
    ...(offer.castLevel === undefined ? {} : { spellCastLevel: offer.castLevel }),
    encounterActorId: input.actorId,
    carrierEffectId: offer.effectId,
    offerIndex: offer.offerIndex,
    holderActorId: offer.holderActorId,
    target: offer.target ?? 'HOLDER',
    attackMechanic:
      offer.attackBonus === undefined
        ? null
        : { attackBonus: offer.attackBonus, rollMode: 'NORMAL' },
    ...(offer.damageExpressions && { damageExpressions: offer.damageExpressions })
  }
  return {
    capability,
    /** The item the cast chose, which the repeat is made on; the carrier ends when it is released. */
    boundItemInstanceId: grant.boundItem?.itemInstanceId,
    freeUseKey
  }
}
