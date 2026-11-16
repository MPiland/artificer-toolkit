import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { prismaticWall } from '@artificer-toolkit/source-data/srd/spells/prismatic-wall.js'

/** What a layered zone authors that later D223 slices model: destruction, proximity, light, placement refusal. */
const LATER_SLICE_KEYS = [
  'destructionMustResolveInOrder',
  'destroyedComponentsRemainDestroyed',
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
 * its caster designates, without anything later slices build.
 */
export function layeredZoneSpell(layerCount = 3): SpellAuthored {
  const spell: SpellAuthored = { ...structuredClone(prismaticWall), label: 'Layered Ward' }
  const path = spell.effects?.[0]?.paths[0]
  if (path?.selectionKind !== 'CHOICE') throw new Error('The wall must offer its forms.')
  for (const { resultBlock } of path.options)
    for (const outcome of resultBlock.outcomes) {
      if (outcome.effectKind !== 'MANIFEST' || outcome.manifestKind !== 'ZONE')
        throw new Error('Each form must place a zone.')
      for (const key of LATER_SLICE_KEYS) delete outcome[key]
      outcome.components = outcome.components
        ?.slice(0, layerCount)
        .map(({ destructionCriteria, blockingRules, ...layer }) => layer)
    }
  return spell
}
