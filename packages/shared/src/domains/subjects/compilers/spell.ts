import type { SpellAuthored } from '#authored'
import {
  SPELL_ATTRIBUTE,
  type CastingTimeUnitCode,
  type SpellComponent,
  type SpellAttribute
} from '#core'
import { compileEffect, type CompiledEffectGroup } from '#compilers'

export type CompiledCastingTime = {
  unit: CastingTimeUnitCode
  amount: number
}

export type CompiledSpell = {
  id: string
  label: string
  level: number
  attributes?: SpellAttribute[]
  components?: SpellComponent[]
  materialDescription?: string
  classIds: string[]
  magicSchoolId: string
  effects?: CompiledEffectGroup[]
  castingTime?: CompiledCastingTime
}

export function compileSpell(authored: SpellAuthored): CompiledSpell {
  const concentration = authored.attributes?.includes(SPELL_ATTRIBUTE.CONCENTRATION) ?? false
  const effects = authored.effects?.length
    ? authored.effects.map((effect) => ({
        ...compileEffect(effect),
        ...(concentration ? { requiresConcentration: true as const } : {})
      }))
    : undefined

  return {
    id: authored.id,
    label: authored.label,
    level: authored.level,
    classIds: authored.classIds,
    attributes: authored.attributes,
    components: authored.components,
    materialDescription: authored.materialDescription,
    magicSchoolId: authored.magicSchoolId,
    effects,
    castingTime: authored.castingTime
  }
}
