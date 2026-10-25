import type { SystemCoreCodeAdapter } from '../../systemCoreCodeCapability.js'
import {
  DND5E_ACTION_TRAITS,
  DND5E_EFFECT_CONSUME_EVENTS,
  DND5E_EFFECT_END_EVENTS
} from './lifecycleVocabulary.js'
import { DND5E_ABILITY_DEFINITION_ID_BY_CODE, DND5E_SYSTEM_ID } from './identity.js'

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

/** Smallest first; Fine, Diminutive, Giant and Colossal fill no space a Scene models. */
export const DND5E_SIZES = [
  { code: 'FINE', label: 'Fine', description: 'Extremely small.' },
  { code: 'DIMUNITIVE', label: 'Diminutive', description: 'Very tiny.' },
  { code: 'TINY', label: 'Tiny', description: 'Very small size.', spaceFeet: 2.5 },
  { code: 'SMALL', label: 'Small', description: 'Below average size.', spaceFeet: 5 },
  {
    code: 'MEDIUM',
    label: 'Medium',
    description: 'Average humanoid size.',
    spaceFeet: 5,
    isDefault: true
  },
  { code: 'LARGE', label: 'Large', description: 'Larger than humanoid.', spaceFeet: 10 },
  { code: 'HUGE', label: 'Huge', description: 'Massive size.', spaceFeet: 15 },
  { code: 'GARGANTUAN', label: 'Gargantuan', description: 'Enormous size.', spaceFeet: 20 },
  { code: 'GIANT', label: 'Giant', description: 'Exceptionally large.' },
  { code: 'COLOSSAL', label: 'Colossal', description: 'Legendary size.' }
] as const

export type Dnd5eRollInfluence = (typeof DND5E_ROLL_INFLUENCES)[number]['code']
export type Dnd5eRollMode = (typeof DND5E_ROLL_MODES)[number]['code']

export const dnd5eCoreCodeAdapter: SystemCoreCodeAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  lists: {
    rollInfluence: DND5E_ROLL_INFLUENCES,
    rollMode: DND5E_ROLL_MODES,
    spellSlotPool: DND5E_SPELL_SLOT_POOLS,
    effectConsumeEvent: DND5E_EFFECT_CONSUME_EVENTS,
    effectEndEvent: DND5E_EFFECT_END_EVENTS,
    actionTrait: DND5E_ACTION_TRAITS,
    size: DND5E_SIZES
  },
  abilities: Object.keys(DND5E_ABILITY_DEFINITION_ID_BY_CODE)
}
