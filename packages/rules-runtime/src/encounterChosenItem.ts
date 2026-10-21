import type { EquipmentInstanceMechanicSource } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CompiledActionActiveEffectPlan } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { readEncounterActorOptionalContestContext } from './encounterActorOptionalContestContext.js'
import { snapshotCreatureEquipmentItems } from './encounterCreatureEquipmentSources.js'
import type { CharacterMovementFacts, MovementTarget } from './encounterMovementTargets.js'

type ChosenItemPlan = NonNullable<CompiledActionActiveEffectPlan['chosenItem']>
/** What a chosen item is read from: the creature and, for a Character, its loaded facts. */
type ChosenItemHolder = Pick<MovementTarget<CharacterMovementFacts>, 'actor' | 'characterFacts'>

/** An item a creature has equipped: what a chosen-item action may name, and whether a hand holds it. */
type EquippedItem = {
  item: EquipmentInstanceMechanicSource
  /** The equipment it is and the equipment it varies, nearest first. */
  equipmentIds: readonly string[]
  category: string
  properties: readonly string[]
  held: boolean
}

/** Only what a hand holds can be dropped; worn items stay (Disarm's rule). */
const isHeldSlot = (slot: string) => slot !== 'WORN'

/** The same fact a Disarm reads: a hand of the Creature holds the entry and its loadout can carry it. */
const isCreatureEntryHeld = (actor: EncounterRunActorState, loadoutEntryId: string) =>
  readEncounterActorOptionalContestContext({ actor, loadoutEntryId }) !== null

function equippedItems(target: ChosenItemHolder): EquippedItem[] {
  const facts = target.characterFacts
  if (target.actor.kind === 'CHARACTER') {
    if (!facts) throw new Error('Chosen item Character facts are unavailable.')
    const compiled = new Map(
      facts.ruleEvaluation.snapshot.equipmentItems.map((entry) => [entry.instanceId, entry])
    )
    return facts.character.state.equipment.equipped.flatMap(({ itemId, slot }) => {
      const entry = compiled.get(itemId)
      if (!entry) throw new Error('Chosen item Character equipment is stale.')
      const { compiledItem } = entry
      const equipmentId = entry.contentRef.definitionId
      return [
        {
          item: { kind: 'EQUIPMENT_INSTANCE', equipmentId, itemInstanceId: itemId },
          equipmentIds: [
            equipmentId,
            ...('parentEquipmentIds' in compiledItem ? compiledItem.parentEquipmentIds : [])
          ],
          category: compiledItem.category,
          properties: compiledItem.properties ?? [],
          held: isHeldSlot(slot)
        }
      ]
    })
  }
  if (target.actor.kind !== 'CREATURE') return []
  return snapshotCreatureEquipmentItems(target.actor).flatMap(({ entry, source }) =>
    entry.useState === 'CARRIED'
      ? []
      : [
          {
            item: {
              kind: 'EQUIPMENT_INSTANCE',
              equipmentId: entry.equipmentId,
              itemInstanceId: entry.id
            },
            equipmentIds: [entry.equipmentId, ...source.compiled.parentEquipmentIds],
            category: source.compiled.category,
            properties: source.compiled.properties,
            held: isCreatureEntryHeld(target.actor, entry.id)
          }
        ]
  )
}

/**
 * The target's equipped items a chosen-item action may be used on (what the caster picks from),
 * each with whether the target can drop it: an item a hand holds is releasable, a worn one is not.
 */
export function listEncounterChosenItems(input: {
  plan: ChosenItemPlan
  target: ChosenItemHolder
}): { item: EquipmentInstanceMechanicSource; releasable: boolean }[] {
  const { plan, target } = input
  // A Creature's modifiers do not yet read the item an attack is made with.
  if (plan.bindsGrant && target.actor.kind !== 'CHARACTER') return []
  return equippedItems(target).flatMap((chosen) =>
    (plan.category === null || chosen.category === plan.category) &&
    plan.requiredProperties.every((property) => chosen.properties.includes(property)) &&
    !plan.excludedProperties.some((property) => chosen.properties.includes(property)) &&
    (plan.equipmentIds.length === 0 ||
      plan.equipmentIds.some((equipmentId) => chosen.equipmentIds.includes(equipmentId)))
      ? [{ item: chosen.item, releasable: chosen.held }]
      : []
  )
}

/**
 * The target's equipped item a chosen-item action is used on (Shillelagh's club, Heat Metal's
 * armor), checked against the plan's filters, and whether the target can drop it: an item a hand
 * holds is releasable, a worn one is not. Null for an action that chooses none.
 */
export function readEncounterChosenItem(input: ChosenItemRead) {
  const read = resolveEncounterChosenItem(input)
  if ('refusal' in read) throw new Error(read.refusal)
  return read.chosen
}

/**
 * Why the action's item choice cannot stand (none chosen, one the action does not take), checked
 * before the action rolls; null when it can.
 */
export function encounterChosenItemRefusal(input: ChosenItemRead): string | null {
  const read = resolveEncounterChosenItem(input)
  return 'refusal' in read ? read.refusal : null
}

type ChosenItemRead = {
  plan: ChosenItemPlan | null | undefined
  target: ChosenItemHolder
  itemInstanceId: string | undefined
}

function resolveEncounterChosenItem({
  plan,
  target,
  itemInstanceId
}: ChosenItemRead):
  | { chosen: { item: EquipmentInstanceMechanicSource; releasable: boolean } | null }
  | { refusal: string } {
  if (!plan)
    return itemInstanceId === undefined
      ? { chosen: null }
      : { refusal: 'This action is not used on an item.' }
  if (itemInstanceId === undefined) return { refusal: 'Choose the item this action is used on.' }
  const chosen = listEncounterChosenItems({ plan, target }).find(
    ({ item }) => item.itemInstanceId === itemInstanceId
  )
  return chosen ? { chosen } : { refusal: 'The chosen item is not one this action can be used on.' }
}

/**
 * The item instances the actor still has on it now, a hand holding the item or the actor wearing it
 * (a grant bound to a worn item, Heat Metal's armor, outlasts a drop that cannot happen): a
 * Character's from its equipped items (`characterEquipped`, required for a Character), a
 * Creature's from its loadout.
 */
export function encounterItemInstanceIdsOnActor(
  actor: EncounterRunActorState,
  characterEquipped: readonly { itemId: string; slot: string }[] | undefined
): string[] {
  if (actor.kind === 'CHARACTER') {
    if (!characterEquipped) throw new Error('Held item Character equipment is unavailable.')
    return characterEquipped.map(({ itemId }) => itemId)
  }
  if (actor.kind !== 'CREATURE') return []
  return snapshotCreatureEquipmentItems(actor).flatMap(({ entry }) =>
    entry.useState === 'WORN' ||
    (entry.useState !== 'CARRIED' && isCreatureEntryHeld(actor, entry.id))
      ? [entry.id]
      : []
  )
}
