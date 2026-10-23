import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'

import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import { UUID, unsupported, type Dnd5eCompiledEffectActionSource } from './effectActionContracts.js'
import { testPhaseKindOrNull } from './effectActionTestPhase.js'

/** A grant that carries a repeat offer (D166): planned beside the effect it rides, not as a modifier grant. */
export function isRepeatCarrierEntry(entry: CompiledEffectGroup['entries'][number]): boolean {
  return (
    'outcome' in entry &&
    entry.outcome.effectKind === 'APPLY_GRANT' &&
    (entry.lifecycle?.effectOffers ?? []).some((offer) => offer.kind === 'REPEAT_SOURCE_PATH')
  )
}

/**
 * The effect a save action leaves that offers the source a repeat of the action's paths, or null when
 * it offers none. The carrier is one grant authored alike on both save results with no modifiers of
 * its own, and it lasts as long as the action's Concentration. A holder offer (Heat Metal's "use a
 * Bonus Action to cause the damage again") is held by the target, bound to the chosen item and ended
 * when that item is released. A FRESH offer (a spell that picks a new creature each turn) is held by
 * the source, binds no item, and ends only with the Concentration. The cast freezes the saving throw
 * DC and the cast level into the offer.
 */
export function repeatCarrierPlan(
  action: Dnd5eCompiledEffectActionSource
): CharacterRuleActionActiveEffectPlan['repeatCarrier'] {
  const [entry, other, ...rest] = action.compiledEffect.entries.flatMap((candidate) =>
    'outcome' in candidate && isRepeatCarrierEntry(candidate) ? [candidate] : []
  )
  if (!entry) return null
  const fresh = (entry.lifecycle?.effectOffers ?? []).some(
    (offer) => offer.kind === 'REPEAT_SOURCE_PATH' && offer.target === 'FRESH'
  )
  if (
    entry.outcome.effectKind !== 'APPLY_GRANT' ||
    testPhaseKindOrNull(action) !== 'SAVE' ||
    rest.length > 0 ||
    (other &&
      (other.pathCode === entry.pathCode || authoredAlike(entry) !== authoredAlike(other))) ||
    (fresh
      ? entry.chosenItem !== undefined || entry.outcome.bindsChosenItem
      : !entry.chosenItem || !entry.outcome.bindsChosenItem) ||
    entry.duration === undefined ||
    !UUID.test(entry.entryId)
  )
    unsupported(
      fresh
        ? 'D&D fresh repeat offer rides one item-free grant authored alike on both save results.'
        : 'D&D repeat offer rides one chosen-item grant authored alike on both save results.'
    )
  const { grants } = entry.outcome
  const { endOnEvents = [], effectOffers = [], ...otherLifecycle } = entry.lifecycle ?? {}
  if (
    grants.modifiers?.length ||
    grants.senses?.length ||
    grants.proficiencies?.length ||
    (fresh
      ? endOnEvents.length !== 0 || effectOffers.length !== 1
      : endOnEvents.length !== 1 || endOnEvents[0] !== 'ON_CHOSEN_ITEM_RELEASED') ||
    Object.values(otherLifecycle).some((value) => value !== undefined)
  )
    unsupported(
      fresh
        ? 'D&D fresh repeat offer carrier grants nothing, ends only with its Concentration and offers one repeat.'
        : 'D&D repeat offer carrier grants nothing and ends when its chosen item is released.'
    )
  return {
    compiledEntryId: entry.entryId,
    frozenGraphNodeId: 'repeat-carrier',
    applyGrantOutcomeId: entry.outcome.id,
    heldBy: fresh ? 'SOURCE' : 'TARGET',
    effectOffers: effectOffers.map((offer) =>
      offer.kind === 'MOVE_HELD_EFFECT' ? { ...offer, range: { ...offer.range } } : { ...offer }
    )
  }
}

/**
 * A grant entry as authored, without its identities or its release flag, so two paths' grants
 * compare alike.
 */
export function authoredAlike(
  entry: Extract<CompiledEffectGroup['entries'][number], { outcome: unknown }>
): string {
  const withoutIdentities = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(withoutIdentities)
      : typeof value === 'object' && value !== null
        ? Object.fromEntries(
            Object.entries(value).flatMap(([key, field]) =>
              key === 'id' || key === 'unlessChosenItemReleased'
                ? []
                : [[key, withoutIdentities(field)]]
            )
          )
        : value
  return JSON.stringify(
    withoutIdentities({
      outcome: entry.outcome,
      duration: entry.duration,
      lifecycle: entry.lifecycle,
      maintenanceDefinitionId: entry.maintenanceDefinitionId
    })
  )
}
