import type { SpellAuthored } from '#authored'
import type { CastingTimeUnitCode, SpellComponent, SpellAttribute } from '#core'
import { compileEffect, type CompiledEffectGroup } from '#compilers'

export type CompiledCastingTime = {
  unit: CastingTimeUnitCode
  amount: number
}

export type CompiledSpell = {
  id: string
  /** Retained for bounded play-surface projections; historical snapshots may omit it. */
  label?: string
  level: number
  attributes?: SpellAttribute[]
  components?: SpellComponent[]
  classIds: string[]
  magicSchoolId: string
  effects?: CompiledEffectGroup[]
  castingTime?: CompiledCastingTime
}

export function compileSpell(authored: SpellAuthored): CompiledSpell {
  const effects = authored.effects?.length ? authored.effects.map(compileEffect) : undefined

  return {
    id: authored.id,
    label: authored.label,
    level: authored.level,
    classIds: authored.classIds,
    attributes: authored.attributes,
    components: authored.components,
    magicSchoolId: authored.magicSchoolId,
    effects,
    castingTime: authored.castingTime
  }
}
