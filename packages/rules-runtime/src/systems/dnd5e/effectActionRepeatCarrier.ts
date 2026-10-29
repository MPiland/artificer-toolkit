import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import { UUID, unsupported, type Dnd5eCompiledEffectActionSource } from './effectActionContracts.js'

/**
 * A chosen-item grant that carries a repeat offer (D166): planned beside the effect it rides, not as
 * a modifier grant. A repeat offer on any other grant is an ordinary grant's offer.
 */
export function isRepeatCarrierEntry(entry: CompiledEffectGroup['entries'][number]): boolean {
  return (
    'outcome' in entry &&
    entry.outcome.effectKind === 'APPLY_GRANT' &&
    entry.chosenItem !== undefined &&
    (entry.lifecycle?.effectOffers ?? []).some((offer) => offer.kind === 'REPEAT_SOURCE_PATH')
  )
}

/**
 * The effect a save action leaves on its target that offers the source a repeat of the action's paths
 * (Heat Metal's "use a Bonus Action to cause the damage again"), or null when it offers none. The
 * carrier is one grant authored alike on both save results with no modifiers of its own; it is bound
 * to the chosen item and ends when that item is released, and it lasts as long as the action's
 * Concentration. The cast freezes the saving throw DC and the cast level into the offer.
 */
export function repeatCarrierPlan(
  action: Dnd5eCompiledEffectActionSource,
  isSave: boolean
): CharacterRuleActionActiveEffectPlan['repeatCarrier'] {
  const [entry, other, ...rest] = action.compiledEffect.entries.flatMap((candidate) =>
    'outcome' in candidate && isRepeatCarrierEntry(candidate) ? [candidate] : []
  )
  if (!entry) return null
  if (
    entry.outcome.effectKind !== 'APPLY_GRANT' ||
    !isSave ||
    rest.length > 0 ||
    (other &&
      (other.pathCode === entry.pathCode || authoredAlike(entry) !== authoredAlike(other))) ||
    !entry.chosenItem ||
    !entry.outcome.bindsChosenItem ||
    entry.duration === undefined ||
    !UUID.test(entry.entryId)
  )
    unsupported('D&D repeat offer rides one chosen-item grant authored alike on both save results.')
  const { grants } = entry.outcome
  const { endTriggers = [], effectOffers = [], ...otherLifecycle } = entry.lifecycle ?? {}
  if (
    grants.modifiers?.length ||
    grants.senses?.length ||
    grants.proficiencies?.length ||
    endTriggers.length !== 1 ||
    endTriggers[0]?.event !== 'LIFECYCLE' ||
    endTriggers[0].timing !== 'END' ||
    endTriggers[0].code !== 'ON_CHOSEN_ITEM_RELEASED' ||
    Object.values(otherLifecycle).some((value) => value !== undefined)
  )
    unsupported(
      'D&D repeat offer carrier grants nothing and ends when its chosen item is released.'
    )
  return {
    compiledEntryId: entry.entryId,
    frozenGraphNodeId: 'repeat-carrier',
    applyGrantOutcomeId: entry.outcome.id,
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
