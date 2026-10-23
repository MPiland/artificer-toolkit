import type { CompiledFeature } from '../features/compilers/feature.js'
import type { CompiledBackground } from '../subjects/compilers/background.js'
import type { CompiledClass } from '../subjects/compilers/class.js'
import type {
  CompiledEquipment,
  CompiledEquipmentVariant
} from '../subjects/compilers/equipment.js'
import type { CompiledFeat } from '../subjects/compilers/feat.js'
import type { CompiledRace } from '../subjects/compilers/race.js'
import type { CompiledSpell } from '../subjects/compilers/spell.js'

export interface CharacterAssemblyRegistrySystemSkill {
  id: string
  code?: string
  label: string
  governingAbilityDefinitionId?: string | null
}

export interface CharacterAssemblyRegistrySystemAbility {
  id: string
  code: string
  label: string
}

export interface CharacterAssemblyRegistrySystemSpeed {
  id: string
  code?: string
  label: string
}

export interface CharacterAssemblyRegistrySystem {
  abilities?: ReadonlyArray<CharacterAssemblyRegistrySystemAbility>
  skills?: ReadonlyArray<CharacterAssemblyRegistrySystemSkill>
  speeds?: ReadonlyArray<CharacterAssemblyRegistrySystemSpeed>
  /** The System's default movement type, the primary speed when the player has not chosen one. */
  defaults?: { movementTypeId: string }
}

export type CharacterAssemblyRegistryFeature = Pick<
  CompiledFeature,
  | 'label'
  | 'charges'
  | 'effects'
  | 'feats'
  | 'modifiers'
  | 'options'
  | 'proficiencies'
  | 'restrictions'
  | 'senses'
  | 'spells'
>

/** Compiled authored records used to assemble normalized Character rule facts. */
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
