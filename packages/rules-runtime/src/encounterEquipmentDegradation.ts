import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'
import type { DegradeEquipmentAuthored } from '@artificer-toolkit/shared/authored'
import type { EffectActionCapabilityDescriptor } from './characterActionCapabilityDiscovery.js'

type DegradableItem = Pick<
  CharacterBuildSnapshot['equipmentItems'][number],
  'instanceId' | 'equippedState' | 'degradation' | 'compiledItem'
>

export type EncounterEquipmentDegradation =
  | { kind: 'NONE'; reason: 'NO_DEGRADATION' | 'NOT_CHARACTER' | 'NO_ELIGIBLE_ITEM' }
  | {
      kind: 'DEGRADE'
      itemInstanceId: string
      /** The penalty the item carries once degraded; the item is gone when `destroyed`. */
      afterPenalty: number
      destroyed: boolean
    }

const categoryByAuthored = { ARMOR: 'ARMOR', SHIELD: 'SHIELD', WEAPON: 'WEAPON' } as const

function isEligible(entry: DegradeEquipmentAuthored, item: DegradableItem): boolean {
  const { category, properties = [] } = item.compiledItem
  return (
    item.equippedState !== undefined &&
    category === categoryByAuthored[entry.category] &&
    // A launcher is not struck by what it shoots; its ammunition is (spent by the shot).
    !(entry.subject === 'ATTACKER_WEAPON' && properties.includes('AMMUNITION')) &&
    (!entry.nonmagical || !properties.includes('MAGIC')) &&
    (entry.materials.length === 0 ||
      entry.materials.some((material) => properties.includes(material)))
  )
}

function isDestroyed(
  entry: DegradeEquipmentAuthored,
  item: DegradableItem,
  afterPenalty: number
): boolean {
  const { kind, value } = entry.destroyWhen
  return kind === 'PENALTY_REACHES'
    ? afterPenalty >= value
    : (('armorClass' in item.compiledItem ? item.compiledItem.armorClass : undefined) ?? 0) -
        afterPenalty <=
        value
}

/**
 * The degradation an action's reached result path puts on one item: the target's worn item, or
 * (`subject` ATTACKER_WEAPON) the weapon the attacker hit with. Entries of the other subject are
 * ignored. Entries are tried in authored order and the first with an eligible item wins;
 * `chosenItemInstanceId` narrows the candidates to that item. An owner that is not a Character
 * carries no tracked equipment, so the outcome is no change, and says why. Pure.
 */
export function planEncounterEquipmentDegradation(input: {
  capability: Pick<EffectActionCapabilityDescriptor, 'compiledEffect'>
  resultPath: string | null | undefined
  /** Defaults to the target's item. */
  subject?: NonNullable<DegradeEquipmentAuthored['subject']>
  /** The owning Character's current items; null for an owner that is not a Character. */
  items: readonly DegradableItem[] | null
  chosenItemInstanceId?: string
}): EncounterEquipmentDegradation {
  const entries = input.capability.compiledEffect.entries.flatMap((entry) =>
    'outcome' in entry &&
    entry.outcome.effectKind === 'DEGRADE_EQUIPMENT' &&
    entry.pathCode === input.resultPath &&
    (entry.outcome.subject ?? 'TARGET_ITEM') === (input.subject ?? 'TARGET_ITEM')
      ? [entry.outcome]
      : []
  )
  if (entries.length === 0) return { kind: 'NONE', reason: 'NO_DEGRADATION' }
  if (input.items === null) return { kind: 'NONE', reason: 'NOT_CHARACTER' }
  const candidates = input.items.filter(
    (item) =>
      input.chosenItemInstanceId === undefined || item.instanceId === input.chosenItemInstanceId
  )
  for (const entry of entries) {
    const item = candidates.find((candidate) => isEligible(entry, candidate))
    if (!item) continue
    const afterPenalty = (item.degradation ?? 0) + entry.step
    return {
      kind: 'DEGRADE',
      itemInstanceId: item.instanceId,
      afterPenalty,
      destroyed: isDestroyed(entry, item, afterPenalty)
    }
  }
  return { kind: 'NONE', reason: 'NO_ELIGIBLE_ITEM' }
}
