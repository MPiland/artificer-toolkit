import type { FeatureBaseAuthored, OptionAuthored } from '#authored'
import type { FeatureSection, NodeSubjectCode } from '#core'

/** What fills an attack slot: one of the Creature's own action Features, or any Attack-action attack. */
export type AttackSlotFiller = { kind: 'FEATURE'; featureId: string } | { kind: 'ANY_ATTACK' }

/** A predicate a slot holds only while true (D93). */
export type AttackSlotCondition =
  | { kind: 'EARLIER_SLOTS_HIT_SAME_TARGET' }
  | { kind: 'TARGET_SIZE_AT_MOST'; size: string }

export interface AttackSlot {
  count: number // int
  fillers: AttackSlotFiller[]
  optional?: boolean
  comesFirst?: boolean
  condition?: AttackSlotCondition
}

/** The attacks a Multiattack-style action opens: alternatives of slots (D93). */
export interface AttackSlotSet {
  alternatives: { slots: AttackSlot[] }[]
}

export interface FeatureOptionChoice {
  level: number // int
  count: number // int
  replaceCount?: number | null // int
}

export type FeatureAuthored<N extends NodeSubjectCode = NodeSubjectCode> =
  FeatureBaseAuthored<N> & {
    section?: FeatureSection
    optionChoices?: FeatureOptionChoice[]
    options?: OptionAuthored<N>[]
    availableAtLevel?: number
    attackSlots?: AttackSlotSet
  }
