import type { EncounterAttackActionStateDto } from '@artificer-toolkit/schema/projections/encounterAttackAction'
import type { FacetDto } from '@artificer-toolkit/schema/shared/facet'
import { normalizeCharacterGrantRestrictions } from './character/characterGrantFoldRestrictionFacts.js'

type Context = {
  /** The actor's stored Attack action; stale unless it belongs to `turnSequence`. */
  attackAction: EncounterAttackActionStateDto | null
  turnSequence: number
  /** The item whose action is being offered; its own attacks never meet the requirement. */
  actingItemInstanceId: string
}

/**
 * Whether an item action's authored facet `requirements` hold in the Encounter: no requirement
 * means always; otherwise some group must hold and every condition in it is decided from the
 * actor's Attack action this turn. A condition an Encounter cannot decide here fails closed.
 */
export function encounterActionRequirementsHold(
  requirements: FacetDto | null | undefined,
  context: Context
): boolean {
  const groups = normalizeCharacterGrantRestrictions(requirements ?? undefined)
  const attacks =
    context.attackAction?.turnSequence === context.turnSequence ? context.attackAction.attacks : []
  return (
    groups.length === 0 ||
    groups.some((group) =>
      group.conditions.every(
        (condition) =>
          // An item action's holder is always a Character.
          (condition.kind === 'HOLDER_KIND' && condition.requiredIds.includes('CHARACTER')) ||
          (condition.kind === 'ATTACK_ACTION_OTHER_WEAPON' &&
            attacks.some(
              ({ item }) =>
                item !== undefined &&
                item.itemInstanceId !== context.actingItemInstanceId &&
                condition.requiredProperties.every((property) => item.properties.includes(property))
            ) ===
              (condition.constraint === 'INCLUDE'))
      )
    )
  )
}
