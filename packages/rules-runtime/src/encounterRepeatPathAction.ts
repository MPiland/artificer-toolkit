import { compileEffect } from '@artificer-toolkit/shared/compilers'

import { normalizeCharacterActionMechanicFacts } from './character/characterActionRuleFacts.js'
import type { EffectActionCapabilityDescriptor } from './characterActionCapabilityDiscovery.js'
import { resolveEffectOffer } from './encounterEffectOffers.js'
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
 * The repeat a repeat action id names, read from the effects held now: an ended carrier or an offer
 * that no longer exists makes the id stale. The capability compiles the offer's frozen Effect like any
 * authored action, so the repeat runs through the normal pipeline.
 */
export function discoverEncounterRepeatPath(input: {
  actorId: string
  actionId: string
  gameSystemId: string
  effectsByHolder: Parameters<typeof resolveEffectOffer>[0]['effectsByHolder']
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
  const capability: EncounterRepeatPathCapabilityDescriptor = {
    kind: 'REPEAT_PATH',
    gameSystemId: input.gameSystemId,
    authoredRootKind: 'effect',
    entryPointDefinitionId: offer.effect.id,
    effectId: offer.effect.id,
    actionId: input.actionId,
    sourceId: offer.effectId,
    label: grant.sourceLabel,
    mechanicFacts: normalizeCharacterActionMechanicFacts(compiledEffect),
    conditionDefinitionIds: normalized.conditionDefinitionIds ?? input.conditionDefinitionIds,
    savingThrowAbilityDefinitionId: normalized.savingThrowAbilityDefinitionId ?? null,
    compiledEffect,
    ...(offer.castLevel === undefined ? {} : { spellCastLevel: offer.castLevel }),
    encounterActorId: input.actorId,
    carrierEffectId: offer.effectId,
    offerIndex: offer.offerIndex,
    holderActorId: offer.holderActorId
  }
  return {
    capability,
    /** The item the cast chose, which the repeat is made on; the carrier ends when it is released. */
    boundItemInstanceId: grant.boundItem?.itemInstanceId
  }
}
