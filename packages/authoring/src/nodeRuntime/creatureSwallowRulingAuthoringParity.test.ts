import { describe, expect, it } from 'vitest'

import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { purpleWorm } from '@artificer-toolkit/source-data/srd/creatures/purple-worm.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T6a1 (D187a): a swallow whose rider needs a save ships as a GM ruling written from the
 * MANUAL_ADJUDICATION option a Builder author has on a creature feature, beside the attack's
 * automated damage. The other swallows run on the holder-turn phase (T6n3, see
 * creatureHeldRelationshipAuthoringParity). Each creature must pass the creature node map exactly
 * as authored, and the six swallow closed rule kinds are gone.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

/** Every outcome the creature feature authors, found by walking its effects and fixed paths. */
function featureOutcomes(creature: CreatureAuthored, label: string) {
  const feature = creature.features?.find((candidate) => candidate.label === label)
  if (!feature) throw new Error(`The creature must author ${label}.`)
  return (feature.effects ?? []).flatMap((effect) =>
    effect.paths.flatMap((path) =>
      path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []
    )
  )
}

describe('swallow riders as GM rulings (D187a)', () => {
  it.each([{ creature: purpleWorm, label: 'Bite' }])(
    'keeps $creature.label $label as a GM ruling with no closed rule',
    async ({ creature, label }) => {
      const kinds = featureOutcomes(creature, label).map(({ effectKind }) => effectKind)
      expect(kinds).toContain('MANUAL_ADJUDICATION')
      expect(kinds).not.toContain('CLOSED_RULE')
      const result = await normalize(creature)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
    }
  )

  it.each([{ creature: purpleWorm, label: 'Bite', damage: ['DAMAGE'] }])(
    'keeps the $creature.label $label damage automated beside the ruling',
    ({ creature, label, damage }) => {
      expect(featureOutcomes(creature, label).map(({ effectKind }) => effectKind)).toEqual([
        ...damage,
        'MANUAL_ADJUDICATION'
      ])
    }
  )

  it('no longer lists the six swallow closed rule kinds', () => {
    for (const kind of [
      'CREATURE_KRAKEN_BITE',
      'CREATURE_REMORHAZ_SWALLOW',
      'CREATURE_TARRASQUE_SWALLOW',
      'GIANT_FROG_SWALLOW',
      'GIANT_TOAD_SWALLOW',
      'PURPLE_WORM_SWALLOW'
    ]) {
      expect(CLOSED_RULE_KIND).not.toHaveProperty(kind)
    }
  })
})
