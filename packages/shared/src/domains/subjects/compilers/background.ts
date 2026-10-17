import type { BackgroundAuthored, StartingEquipmentAuthored } from '#authored'
import { compileFeature, type CompiledFeature } from '#compilers'
import { compileProficiencyGrant, type CompiledProficiencyGrant } from '#compilers'

export type CompiledBackground = {
  id: string
  proficiencies?: CompiledProficiencyGrant[]
  features?: CompiledFeature[]
  startingEquipment?: StartingEquipmentAuthored
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

  return {
    id: authored.id,
    features,
    proficiencies,
    startingEquipment: authored.startingEquipment
  }
}
