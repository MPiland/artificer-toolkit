import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { srdCreatureRecords } from '@artificer-toolkit/source-data/srd/creatures/index.js'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { holdPerson } from '@artificer-toolkit/source-data/srd/spells/hold-person.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33.T7a (D156): the SRD creatures whose successful save makes the target immune to that
 * source's use of the action for 24 hours author it with SOURCE_IMMUNITY, a core option the effect
 * node map keeps exactly as authored (ADR 0038).
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(mapId: 'equipment' | 'creature', values: unknown) {
  return normalizeNodeRuntimeValues(reader, {
    mapId,
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as Record<string, unknown>
  })
}

/** Whether the value nests a SOURCE_IMMUNITY outcome. */
function hasSourceImmunity(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  if ('effectKind' in value && value.effectKind === 'SOURCE_IMMUNITY') return true
  return Object.values(value).some(hasSourceImmunity)
}

const IMMUNITY_FEATURES = srdCreatureRecords.flatMap((creature) =>
  creature.features.flatMap((feature, index) =>
    hasSourceImmunity(feature.effects)
      ? [{ creature: creature.label, feature: feature.label, index, record: creature }]
      : []
  )
)

describe('a save that makes its target immune to the source (SPELLS-33.T7a, ADR 0038)', () => {
  it('authors the Cloaker, the Nalfeshnee, the Tarrasque and the 20 adult and ancient dragons with it', () => {
    expect(IMMUNITY_FEATURES.map(({ creature, feature }) => `${creature}: ${feature}`)).toEqual(
      expect.arrayContaining([
        'Cloaker: Moan',
        'Nalfeshnee: Horror Nimbus (Recharge 5-6)',
        'Tarrasque: Frightful Presence',
        'Adult Red Dragon: Frightful Presence',
        'Ancient White Dragon: Frightful Presence'
      ])
    )
    expect(IMMUNITY_FEATURES.filter(({ creature }) => creature.endsWith(' Dragon')).length).toBe(20)
  })

  it.each(IMMUNITY_FEATURES)(
    'keeps the $creature’s $feature exactly as authored',
    async ({ record, index }) => {
      const result = await normalize('creature', record)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features', index, 'effects'])).toEqual(
        record.features[index]?.effects
      )
    }
  )

  it('lets an author make any save’s success grant it, so a homebrew hold builds what the Moan does', async () => {
    const moan = IMMUNITY_FEATURES.find(({ feature }) => feature === 'Moan')
    const successPath = moan?.record.features[moan.index]?.effects?.[0]?.paths.find(
      ({ pathCode }) => pathCode === 'ON_SAVE_SUCCESS'
    )
    if (!successPath) throw new Error('The Moan has no success path.')
    const effect = structuredClone(holdPerson.effects?.[0])
    if (!effect) throw new Error('Hold Person has no effect.')
    const authored = {
      ...structuredClone(caltropsBagOf20),
      effects: [{ ...effect, paths: [...effect.paths, structuredClone(successPath)] }]
    } as EquipmentAuthored
    const result = await normalize('equipment', authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })
})
