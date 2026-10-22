import type { SystemVocabularyCapabilityAdapter } from '../../systemVocabularyCapability.js'
import { DND5E_SYSTEM_ID } from './identity.js'

export const DND5E_ROLL_INFLUENCES = [
  { code: 'ADVANTAGE', label: 'Advantage' },
  { code: 'DISADVANTAGE', label: 'Disadvantage' }
] as const

export const DND5E_ROLL_MODES = [
  { code: 'NORMAL', label: 'Normal' },
  ...DND5E_ROLL_INFLUENCES
] as const

export type Dnd5eRollInfluence = (typeof DND5E_ROLL_INFLUENCES)[number]['code']
export type Dnd5eRollMode = (typeof DND5E_ROLL_MODES)[number]['code']

export const dnd5eVocabularyCapabilityAdapter: SystemVocabularyCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  lists: { rollInfluence: DND5E_ROLL_INFLUENCES, rollMode: DND5E_ROLL_MODES }
}
