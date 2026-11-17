import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { prismaticWall } from '@artificer-toolkit/source-data/srd/spells/prismatic-wall.js'

/**
 * What a layered zone authors beyond its layers: proximity, light, placement refusal and what ends
 * the whole zone. A test that needs one puts it back from the SRD wall.
 */
const LATER_SLICE_KEYS = [
  'placementMustBeUnoccupied',
  'invalidPlacementConsumesInvocation',
  'proximityRule',
  'light',
  'destructionCriteria'
] as const

/**
 * A layered zone authored from core options (D223): the SRD Prismatic Wall's wall and sphere with
 * only their first `layerCount` layers (Red fire, Orange acid, Yellow lightning: a Dexterity save
 * against the caster's DC for 10d6, half on a success), resolving in order and sparing the creatures
 * its caster designates, each destroyed in order by what it authors (Red by 25 cold damage, Orange
 * by a strong wind, Yellow by 60 force damage), without anything later slices build. It lasts
 * `minutes` (10, as the wall does) with no Concentration. With `proximityEvents` it also keeps the
 * wall's 20 ft proximity rule (a creature that sees the zone saves or is blinded for a minute), met
 * on those events.
 */
export function layeredZoneSpell(
  layerCount = 3,
  minutes = 10,
  proximityEvents?: readonly ('MOVE_WITHIN' | 'START_TURN')[]
): SpellAuthored {
  const spell: SpellAuthored = { ...structuredClone(prismaticWall), label: 'Layered Ward' }
  const path = spell.effects?.[0]?.paths[0]
  if (path?.selectionKind !== 'CHOICE') throw new Error('The wall must offer its forms.')
  for (const { resultBlock } of path.options) {
    if (resultBlock.duration && 'amount' in resultBlock.duration)
      resultBlock.duration.amount = minutes
    for (const outcome of resultBlock.outcomes) {
      if (outcome.effectKind !== 'MANIFEST' || outcome.manifestKind !== 'ZONE')
        throw new Error('Each form must place a zone.')
      const { proximityRule } = outcome
      for (const key of LATER_SLICE_KEYS) delete outcome[key]
      if (proximityEvents && proximityRule)
        outcome.proximityRule = { ...proximityRule, events: [...proximityEvents] }
      outcome.components = outcome.components
        ?.slice(0, layerCount)
        .map(({ blockingRules, ...layer }) => layer)
    }
  }
  return spell
}
