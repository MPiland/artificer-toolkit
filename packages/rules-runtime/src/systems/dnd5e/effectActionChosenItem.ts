import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import { unsupported, type Dnd5eCompiledEffectActionSource } from './effectActionContracts.js'
import { isRepeatCarrierEntry } from './effectActionRepeatCarrier.js'

/**
 * The item a grant plan's action is used on, from its authored paths (see the plan's
 * `chosenItem`); null when it names none. The paths name one item, a bound grant's modifiers are
 * all scoped to their source (the item), and a release is one save result's, the result a grant
 * withheld on release is authored on.
 */
export function chosenItemPlan(
  action: Dnd5eCompiledEffectActionSource
): NonNullable<CharacterRuleActionActiveEffectPlan['chosenItem']> | null {
  const entries = action.compiledEffect.entries.flatMap((entry) =>
    'outcome' in entry ? [entry] : []
  )
  const items = new Set(
    entries.flatMap(({ chosenItem }) => (chosenItem ? [JSON.stringify(chosenItem)] : []))
  )
  // A repeat carrier is bound to the item by its own plan, not the modifier grant's.
  const grants = entries.flatMap((entry) =>
    entry.outcome.effectKind === 'APPLY_GRANT' && !isRepeatCarrierEntry(entry)
      ? [{ pathCode: entry.pathCode, outcome: entry.outcome }]
      : []
  )
  const [releasedOn, ...otherReleasePaths] = new Set(
    entries.flatMap((entry) =>
      entry.outcome.effectKind === 'RELEASE_CHOSEN_ITEM' ? [entry.pathCode] : []
    )
  )
  const bound = grants.filter(({ outcome }) => outcome.bindsChosenItem)
  const withheld = grants.filter(({ outcome }) => outcome.unlessChosenItemReleased)
  const item = entries.find(({ chosenItem }) => chosenItem)?.chosenItem
  if (!item) {
    if (bound.length + withheld.length > 0 || releasedOn !== undefined)
      unsupported('D&D action uses a chosen item it does not name.')
    return null
  }
  if (items.size !== 1) unsupported('D&D action paths must name one chosen item.')
  if (
    otherReleasePaths.length > 0 ||
    (releasedOn !== undefined && releasedOn !== 'ON_SAVE_FAIL' && releasedOn !== 'ON_SAVE_SUCCESS')
  )
    unsupported('D&D chosen item is released on one save result.')
  if (withheld.some(({ pathCode }) => pathCode !== releasedOn))
    unsupported('D&D grant withheld on release must be authored on the release result.')
  if (
    bound.some(
      ({ outcome }) =>
        outcome.grants.senses?.length ||
        (outcome.grants.modifiers ?? []).some(({ scope }) => scope !== 'SOURCE')
    )
  )
    unsupported('D&D grant bound to a chosen item grants only modifiers scoped to it.')
  return {
    category: item.category ?? null,
    requiredProperties: [...new Set(item.requiredProperties ?? [])].sort(),
    excludedProperties: [...new Set(item.excludedProperties ?? [])].sort(),
    equipmentIds: [...new Set(item.equipmentIds ?? [])].sort(),
    bindsGrant: bound.length > 0,
    releasedOn: releasedOn ?? null,
    grantUnlessReleased: withheld.length > 0
  }
}
