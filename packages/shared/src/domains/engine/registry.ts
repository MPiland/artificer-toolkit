import type { CompiledClass } from '../subjects/compilers/class.js'
import type { CompiledBackground } from '../subjects/compilers/background.js'
import type { CompiledEquipment, CompiledEquipmentVariant } from '../subjects/compilers/equipment.js'
import type { CompiledFeat } from '../subjects/compilers/feat.js'
import type { CompiledRace } from '../subjects/compilers/race.js'
import type { CompiledSpell } from '../subjects/compilers/spell.js'
import type { CompiledFeature } from '../features/compilers/feature.js'

export interface CharacterAssemblyRegistrySystemSkill {
  id: string
  code?: string
  label: string
}

export interface CharacterAssemblyRegistrySystem {
  skills?: ReadonlyArray<CharacterAssemblyRegistrySystemSkill>
}

export type CharacterAssemblyRegistryFeature = Pick<
  CompiledFeature,
  'feats' | 'modifiers' | 'options' | 'proficiencies' | 'restrictions' | 'senses' | 'spells'
>

/**
 * Registry of compiled domain objects used by the assembly + engine pipeline.
 *
 * The registry is caller-populated (API route or test) by loading compiled
 * objects from DB repositories. Assembly and engine functions are pure readers —
 * they never load from the DB themselves.
 */
export interface CharacterAssemblyRegistry {
  backgrounds?: Record<string, CompiledBackground | undefined>
  features: Record<string, CharacterAssemblyRegistryFeature | undefined>
  classes: Record<string, CompiledClass | undefined>
  feats: Record<string, CompiledFeat | undefined>
  system?: CharacterAssemblyRegistrySystem | null
  races: Record<string, CompiledRace | undefined>
  equipment: Record<string, CompiledEquipment | CompiledEquipmentVariant | undefined>
  spells: Record<string, CompiledSpell | undefined>
}
