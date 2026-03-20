import type {
  SpellAuthored
} from '#authored'
import type {
  CastingTimeUnitCode,
  SpellAttribute
} from '#core'
import { compileCapability, type CompiledCapabilityGroup } from '#compilers'

export type CompiledCastingTime = {
  unit: CastingTimeUnitCode
  amount: number
}

export type CompiledSpell = {
  id: string
  level: number
  attributes?: SpellAttribute[]
  classIds: string[]
  magicSchoolId: string
  capabilities?: CompiledCapabilityGroup[]
  castingTime?: CompiledCastingTime
}

export function compileSpell(authored: SpellAuthored): CompiledSpell {
  const capabilities
    = (authored.capabilities ?? authored.effects)?.length
      ? (authored.capabilities ?? authored.effects)?.map(compileCapability)
      : undefined

  return {
    id: authored.id,
    level: authored.level,
    classIds: authored.classIds,
    attributes: authored.attributes,
    magicSchoolId: authored.magicSchoolId,
    capabilities,
    castingTime: authored.castingTime
  }
}
