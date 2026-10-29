import { EFFECT_KIND, type RoundingCode } from '#core'

/**
 * Moves value between the actor's own spell slots and a feature charge pool, applied by the
 * Sheet `EXCHANGE_SPELL_SLOTS` command. RECOVER_SLOTS frees expended slots whose levels sum to
 * at most the class-level budget; SLOT_TO_RESOURCE expends one slot and the `chargeId` pool
 * gains its level; RESOURCE_TO_SLOT spends `cost` from the pool for one extra slot that lasts
 * until the next long rest.
 */
export type SpellSlotExchangeAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.SPELL_SLOT_EXCHANGE
} & (
  | {
      mode: 'RECOVER_SLOTS'
      levelBudget: { classId: string; divisor: number; rounding: RoundingCode }
      maximumSlotLevel: number // int 1-9
    }
  | { mode: 'SLOT_TO_RESOURCE'; chargeId: string; maximumSlotLevel?: number }
  | {
      mode: 'RESOURCE_TO_SLOT'
      chargeId: string
      costs: { slotLevel: number; cost: number }[]
    }
)
