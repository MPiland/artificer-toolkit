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

/** One Effect of a spell as the spell compiles it: a Concentration spell's Effect requires it. */
export function compileSpellEffect(
  authored: Pick<SpellAuthored, 'attributes' | 'effects'>,
  effect: NonNullable<SpellAuthored['effects']>[number]
): CompiledEffectGroup {
  const concentration = authored.attributes?.includes(SPELL_ATTRIBUTE.CONCENTRATION) ?? false
  return {
    ...compileEffect(effect, authored.effects),
    ...(concentration ? { requiresConcentration: true as const } : {})
  }
}

export function compileSpell(authored: SpellAuthored): CompiledSpell {
  const compiled = (authored.effects ?? []).map((effect) => compileSpellEffect(authored, effect))
  // A sibling Effect that a repeat offer re-runs is not a cast of its own: it lives in the offer.
  const repeatedIds = new Set(
    compiled.flatMap(({ id: carrierId, entries }) =>
      entries.flatMap((entry) =>
        'lifecycle' in entry
          ? (entry.lifecycle?.effectOffers ?? []).flatMap((offer) =>
              offer.kind === 'REPEAT_SOURCE_PATH' && offer.effect.id !== carrierId
                ? [offer.effect.id]
                : []
            )
          : []
      )
    )
  )
  const castable = compiled.filter(({ id }) => !repeatedIds.has(id))
  const effects = castable.length ? castable : undefined

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
