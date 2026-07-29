import type { BackgroundAuthored } from '#authored'
import { compileFeature, type CompiledFeature } from '#compilers'
import { compileStartingEquipment, compileProficiencyGrant } from '#compilers'
import type { CompiledStartingEquipment, CompiledProficiencyGrant } from '#compilers'

export type CompiledBackground = {
  id: string
  proficiencies?: CompiledProficiencyGrant[]
  features?: CompiledFeature[]
  startingEquipment?: CompiledStartingEquipment
}

export function compileBackground(authored: BackgroundAuthored) {
  const proficiencies =
    authored.proficiencies && authored.proficiencies.length
      ? authored.proficiencies.map(compileProficiencyGrant)
      : undefined

  const features =
    authored.features && authored.features.length
      ? authored.features.map(compileFeature)
      : undefined

  const startingEquipment = authored.startingEquipment
    ? compileStartingEquipment(authored.startingEquipment)
    : undefined

  return {
    id: authored.id,
    features,
    proficiencies,
    startingEquipment
  }
}
