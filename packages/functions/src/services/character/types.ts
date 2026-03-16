import type { CompiledModifierGrant } from '@artificer-toolkit/shared'

export interface CharacterAssemblyRegistryFeature {
  modifiers?: CompiledModifierGrant[]
}

export interface CharacterAssemblyRegistry {
  features: Record<string, CharacterAssemblyRegistryFeature | undefined>
}
