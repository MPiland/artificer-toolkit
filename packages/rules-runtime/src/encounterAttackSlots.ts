import type {
  AttackSlotConditionDto,
  AttackSlotDto,
  AttackSlotSetDto
} from '@artificer-toolkit/schema/features/attackSlots'
import { systemCoreCodeRegistry } from './platformSystemCoreCodes.js'
import { sizeRank } from './systemSizes.js'

export type AttackSlotAlternatives = AttackSlotSetDto['alternatives']

/** One attack as the slots see it: what it was, who it targeted and whether it hit. */
export type AttackSlotAttack = {
  /** The Creature Feature the attack came from; null for a Character's. */
  featureId: string | null
  /** Whether it is an Attack-action attack, which an "any attack" filler accepts. */
  attack: boolean
  targetIds: readonly string[]
  /** Whether the attack roll hit; null when it has no roll or is not yet rolled. */
  hit: boolean | null
  /** The target's size; null when unknown, which satisfies a size predicate, while a size the System does not list never does. */
  targetSize: string | null
}

type Assignment = { remaining: number[] }

function fills(slot: AttackSlotDto, attack: AttackSlotAttack) {
  return slot.fillers.some((filler) =>
    filler.kind === 'ANY_ATTACK' ? attack.attack : filler.featureId === attack.featureId
  )
}

/**
 * Whether an authored predicate holds for an attack, given the attacks made before it in the same
 * Attack action: a slot's condition (D93), and the gate on a hold an attack applies (D105).
 */
export function attackSlotConditionHolds(
  gameSystemId: string,
  condition: AttackSlotConditionDto,
  attack: Pick<AttackSlotAttack, 'targetIds' | 'targetSize'>,
  earlier: readonly AttackSlotAttack[]
) {
  if (condition.kind === 'TARGET_SIZE_AT_MOST') {
    systemCoreCodeRegistry.requireCode(gameSystemId, 'size', condition.size)
    if (attack.targetSize === null) return true
    const rank = sizeRank(gameSystemId, attack.targetSize)
    return rank !== null && rank <= (sizeRank(gameSystemId, condition.size) ?? -1)
  }
  if (earlier.length === 0 || !earlier.every((made) => made.hit === true)) return false
  const shared = [...earlier, ...(attack.targetIds.length ? [attack] : [])].reduce<
    ReadonlySet<string> | undefined
  >(
    (common, made) =>
      common ? new Set(made.targetIds.filter((id) => common.has(id))) : new Set(made.targetIds),
    undefined
  )
  return shared !== undefined && shared.size > 0
}

/** Every way the attacks fill the alternative's slots, as what each slot has left. */
function assignments(
  gameSystemId: string,
  slots: readonly AttackSlotDto[],
  attacks: readonly AttackSlotAttack[],
  index: number,
  state: { remaining: number[]; startedOther: boolean }
): Assignment[] {
  if (index === attacks.length) return [{ remaining: state.remaining }]
  const attack = attacks[index]
  const earlier = attacks.slice(0, index)
  return slots.flatMap((slot, slotIndex) => {
    if (state.remaining[slotIndex] === 0 || !fills(slot, attack)) return []
    if (slot.condition && !attackSlotConditionHolds(gameSystemId, slot.condition, attack, earlier))
      return []
    if (slot.comesFirst) {
      if (state.startedOther) return []
    } else if (
      slots.some(
        (other, otherIndex) =>
          other.comesFirst && !other.optional && state.remaining[otherIndex] > 0
      )
    )
      return []
    const remaining = [...state.remaining]
    remaining[slotIndex] -= 1
    return assignments(gameSystemId, slots, attacks, index + 1, {
      remaining,
      startedOther: state.startedOther || !slot.comesFirst
    })
  })
}

/**
 * Whether the attacks made so far, in order, fit some alternative, and whether a fitting alternative
 * still has a required slot to fill (the action is then incomplete).
 */
export function evaluateAttackSlots(
  gameSystemId: string,
  alternatives: AttackSlotAlternatives,
  attacks: readonly AttackSlotAttack[]
): { fits: boolean; incomplete: boolean } {
  let fits = false
  let incomplete = false
  for (const { slots } of alternatives) {
    const found = assignments(gameSystemId, slots, attacks, 0, {
      remaining: slots.map((slot) => slot.count),
      startedOther: false
    })
    if (found.length === 0) continue
    fits = true
    if (
      found.some(({ remaining }) =>
        slots.some((slot, slotIndex) => !slot.optional && remaining[slotIndex] > 0)
      )
    )
      incomplete = true
  }
  return { fits, incomplete }
}

/** The most attacks any alternative allows. */
export function attackSlotTotal(alternatives: AttackSlotAlternatives): number {
  return Math.max(
    ...alternatives.map(({ slots }) => slots.reduce((sum, slot) => sum + slot.count, 0))
  )
}

/** Whether a Feature fills a slot of any alternative; such an action is tracked in the Attack action. */
export function isAttackSlotFiller(
  alternatives: AttackSlotAlternatives,
  featureId: string
): boolean {
  return alternatives.some(({ slots }) =>
    slots.some((slot) =>
      slot.fillers.some((filler) => filler.kind === 'FEATURE' && filler.featureId === featureId)
    )
  )
}
