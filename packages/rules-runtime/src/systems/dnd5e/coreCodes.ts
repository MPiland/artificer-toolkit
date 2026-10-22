import type { SystemCoreCodeAdapter } from '../../systemCoreCodeCapability.js'
import { DND5E_SYSTEM_ID } from './identity.js'

export const DND5E_ROLL_INFLUENCES = [
  { code: 'ADVANTAGE', label: 'Advantage', description: 'Roll two d20s and use the higher.' },
  { code: 'DISADVANTAGE', label: 'Disadvantage', description: 'Roll two d20s and use the lower.' }
] as const

export const DND5E_ROLL_MODES = [
  { code: 'NORMAL', label: 'Normal', description: 'Roll one d20.' },
  ...DND5E_ROLL_INFLUENCES
] as const

/** The slot pools a spell grant's `slotCost` may name, beside the slot of the cast's own level. */
export const DND5E_SPELL_SLOT_POOLS = [
  { code: 'PACT', label: 'Pact Magic', recoversOnShortRest: true }
] as const

/** The pool a Pact caster's slots draw from. */
export const DND5E_PACT_POOL_CODE = DND5E_SPELL_SLOT_POOLS[0].code

export type Dnd5eRollInfluence = (typeof DND5E_ROLL_INFLUENCES)[number]['code']
export type Dnd5eRollMode = (typeof DND5E_ROLL_MODES)[number]['code']

export const dnd5eCoreCodeAdapter: SystemCoreCodeAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  lists: {
    rollInfluence: DND5E_ROLL_INFLUENCES,
    rollMode: DND5E_ROLL_MODES,
    spellSlotPool: DND5E_SPELL_SLOT_POOLS
  }
}
