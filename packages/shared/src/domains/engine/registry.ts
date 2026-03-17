import type { CompiledClass } from '../subjects/compilers/class.js'
import type { CompiledEquipment, CompiledEquipmentVariant } from '../subjects/compilers/equipment.js'
import type { CompiledFeat } from '../subjects/compilers/feat.js'
import type { CompiledSpell } from '../subjects/compilers/spell.js'
import type { CompiledModifierGrant } from '../grants/compilers/modifier.js'

export interface CharacterAssemblyRegistryFeature {
  modifiers?: CompiledModifierGrant[]
}

/**
 * Registry of compiled domain objects used by the assembly + engine pipeline.
 *
 * The registry is caller-populated (API route or test) by loading compiled
 * objects from DB repositories. Assembly and engine functions are pure readers —
 * they never load from the DB themselves.
 */
export interface CharacterAssemblyRegistry {
  features: Record<string, CharacterAssemblyRegistryFeature | undefined>
  classes: Record<string, CompiledClass | undefined>
  feats: Record<string, CompiledFeat | undefined>
  equipment: Record<string, CompiledEquipment | CompiledEquipmentVariant | undefined>
  spells: Record<string, CompiledSpell | undefined>
}
