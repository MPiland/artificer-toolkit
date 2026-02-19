import type { SpellAuthored } from '#authored'
import type {
  CastingTimeUnitCode,
  SpellAttribute
} from '#core'
import { compileEffect, type CompiledEffectGroup } from '#compiler'

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
  effects?: CompiledEffectGroup[]
  castingTime?: CompiledCastingTime
}

export function compileSpell(authored: SpellAuthored): CompiledSpell {
  const effects
    = authored.effects && authored.effects.length
      ? authored.effects.map(compileEffect)
      : undefined

  return {
    id: authored.id,
    level: authored.level,
    classIds: authored.classIds,
    attributes: authored.attributes,
    magicSchoolId: authored.magicSchoolId,
    effects,
    castingTime: authored.castingTime
  }
}
