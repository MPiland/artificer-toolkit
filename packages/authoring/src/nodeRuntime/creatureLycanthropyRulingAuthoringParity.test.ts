import { describe, expect, it } from 'vitest'

import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { werebear } from '@artificer-toolkit/source-data/srd/creatures/werebear.js'
import { wereboar } from '@artificer-toolkit/source-data/srd/creatures/wereboar.js'
import { wererat } from '@artificer-toolkit/source-data/srd/creatures/wererat.js'
import { weretiger } from '@artificer-toolkit/source-data/srd/creatures/weretiger.js'
import { werewolf } from '@artificer-toolkit/source-data/srd/creatures/werewolf.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T6b2 (D187a): the lycanthropy curse ships as a GM ruling written from the
 * MANUAL_ADJUDICATION option a Builder author has on a creature feature, beside the bite's
 * automated damage. Each lycanthrope must pass the creature node map exactly as authored, and the
 * five lycanthropy closed rule kinds are gone.
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

describe('lycanthropy curse as a GM ruling (D187a)', () => {
  it.each([
    { creature: werebear, label: 'Bite (Bear or Hybrid Form Only)' },
    { creature: wereboar, label: 'Tusks (Boar or Hybrid Form Only)' },
    { creature: wererat, label: 'Bite (Rat or Hybrid Form Only)' },
    { creature: weretiger, label: 'Bite (Tiger or Hybrid Form Only)' },
    { creature: werewolf, label: 'Bite (Wolf or Hybrid Form Only)' }
  ])(
    'keeps the $creature.label damage automated beside the curse ruling',
    async ({ creature, label }) => {
      expect(featureOutcomes(creature, label).map(({ effectKind }) => effectKind)).toEqual([
        'DAMAGE',
        'MANUAL_ADJUDICATION'
      ])
      const result = await normalize(creature)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
    }
  )

  it('no longer lists the five lycanthropy closed rule kinds', () => {
    for (const kind of [
      'CREATURE_WEREBEAR_BITE',
      'CREATURE_WEREBOAR_TUSKS',
      'CREATURE_WERERAT_BITE',
      'CREATURE_WERETIGER_BITE',
      'CREATURE_WEREWOLF_BITE'
    ]) {
      expect(CLOSED_RULE_KIND).not.toHaveProperty(kind)
    }
  })
})
