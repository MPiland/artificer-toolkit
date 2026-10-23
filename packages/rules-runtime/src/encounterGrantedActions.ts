import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { GrantedAction } from '@artificer-toolkit/schema/effects/grantedAction'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'

import {
  encounterBasicActionDefinitionId,
  GRANTED_ACTION_ID_SEPARATOR
} from './encounterBasicActionCapabilityDiscovery.js'
import { snapshotFeatureDefinitions } from './encounterActorState.js'

/** One offer of a held effect, with the identity its uses are counted under (D160). */
export interface HeldGrantedAction {
  effectId: string
  offerIndex: number
  offer: GrantedAction
}

type HeldEffect = Pick<ActiveRuleEffectRecord, 'id' | 'definition'>

/** The id of a basic action taken through an offer: the basic action's id plus the offer's identity. */
export function grantedActionId(baseActionId: string, effectId: string, offerIndex: number) {
  return `${baseActionId}${GRANTED_ACTION_ID_SEPARATOR}${effectId}:${offerIndex}`
}

/** The basic action and the offer a granted action id names; null for any other id. */
export function parseGrantedActionId(actionId: string) {
  const at = actionId.lastIndexOf(GRANTED_ACTION_ID_SEPARATOR)
  if (at < 0) return null
  const [effectId, index, ...rest] = actionId
    .slice(at + GRANTED_ACTION_ID_SEPARATOR.length)
    .split(':')
  const offerIndex = Number(index)
  if (!effectId || rest.length > 0 || !Number.isInteger(offerIndex) || offerIndex < 0) return null
  return { baseActionId: actionId.slice(0, at), effectId, offerIndex }
}

/** The once-per-turn key of one use of a capped offer, shared by everything the offer grants. */
function grantedActionUseKey(effectId: string, offerIndex: number, use: number) {
  return `granted:${effectId}:${offerIndex}:${use}`
}

/** The offers the effects a holder keeps make, in a stable order. */
export function heldGrantedActions(effects: readonly HeldEffect[]): HeldGrantedAction[] {
  return effects.flatMap((effect) =>
    effect.definition.stateContributions.flatMap((contribution) =>
      contribution.kind !== 'MODIFIER_GRANT'
        ? []
        : (contribution.grantedActions ?? []).map((offer, offerIndex) => ({
            effectId: effect.id,
            offerIndex,
            offer
          }))
    )
  )
}

/**
 * The offers a Creature's traits make on every turn: a passive trait whose grant has no duration
 * (Goblin's Nimble Escape). The trait's effect id stands in for the held effect's id.
 */
export function standingGrantedActions(features: readonly FeatureDto[]): HeldGrantedAction[] {
  return features.flatMap((feature) =>
    (feature.effects ?? []).flatMap((effect) =>
      effect.invocation.kind !== 'PASSIVE'
        ? []
        : (effect.paths ?? [])
            .flatMap((path) =>
              path.selectionKind !== 'FIXED' ||
              path.resultBlock.duration ||
              !path.resultBlock.outcomes.some(({ effectKind }) => effectKind === 'APPLY_GRANT')
                ? []
                : (path.resultBlock.lifecycle?.grantedActions ?? [])
            )
            .map((offer, offerIndex) => ({ effectId: effect.id, offerIndex, offer }))
    )
  )
}

/** The once-per-turn key the first of these offers with a use left would spend; null when none. */
export function firstGrantedActionUseKey(
  holds: readonly HeldGrantedAction[],
  spentKeys: readonly string[]
): string | null {
  return (
    holds
      .map((held) => nextGrantedActionUseKey(held, spentKeys))
      .find((key): key is string => typeof key === 'string') ?? null
  )
}

/** Every offer the actor holds: its held effects' and its Creature traits'. */
export function actorGrantedActions(
  heldEffects: readonly HeldEffect[],
  actor: Parameters<typeof snapshotFeatureDefinitions>[0]
): HeldGrantedAction[] {
  return [
    ...heldGrantedActions(heldEffects),
    ...standingGrantedActions(snapshotFeatureDefinitions(actor))
  ]
}

/**
 * The key the next use of an offer spends: null for an offer that spends an allowance instead of a
 * count, and `undefined` when a capped offer has no use left this turn (`spentKeys` is the turn's
 * spent once-per-turn keys).
 */
export function nextGrantedActionUseKey(
  held: HeldGrantedAction,
  spentKeys: readonly string[]
): string | null | undefined {
  const { usesPerTurn } = held.offer
  if (held.offer.activation !== 'FREE' || usesPerTurn === undefined) return null
  for (let use = 1; use <= usesPerTurn; use += 1) {
    const key = grantedActionUseKey(held.effectId, held.offerIndex, use)
    if (!spentKeys.includes(key)) return key
  }
  return undefined
}

/**
 * The offer a granted action id names, read from the holder's effects (and its standing offers) as
 * they stand now: an effect that has ended, or an offer that no longer names the action, makes the
 * id stale. `useKey` is the key the action spends, null when it spends an allowance.
 */
export function resolveGrantedAction(input: {
  actionId: string
  heldEffects: readonly HeldEffect[]
  standing?: readonly HeldGrantedAction[]
  spentKeys: readonly string[]
}) {
  const parsed = parseGrantedActionId(input.actionId)
  const held = parsed
    ? [...heldGrantedActions(input.heldEffects), ...(input.standing ?? [])].find(
        ({ effectId, offerIndex }) =>
          effectId === parsed.effectId && offerIndex === parsed.offerIndex
      )
    : undefined
  if (
    !parsed ||
    !held ||
    !held.offer.actionDefinitionIds.includes(encounterBasicActionDefinitionId(parsed.baseActionId))
  )
    throw new Error('The selected granted action is stale.')
  const useKey = nextGrantedActionUseKey(held, input.spentKeys)
  if (useKey === undefined)
    throw new Error('The selected granted action has no use left this turn.')
  return { baseActionId: parsed.baseActionId, offer: held.offer, useKey }
}
