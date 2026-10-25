import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { ghost } from '@artificer-toolkit/source-data/srd/creatures/ghost.js'
import { guardianNaga } from '@artificer-toolkit/source-data/srd/creatures/guardian-naga.js'
import { lemure } from '@artificer-toolkit/source-data/srd/creatures/lemure.js'
import { lich } from '@artificer-toolkit/source-data/srd/creatures/lich.js'
import { mummyLord } from '@artificer-toolkit/source-data/srd/creatures/mummy-lord.js'
import { nightHag } from '@artificer-toolkit/source-data/srd/creatures/night-hag.js'
import { spiritNaga } from '@artificer-toolkit/source-data/srd/creatures/spirit-naga.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T4gh (D156, D187a): the five Rejuvenations and the Ghost and Night Hag Etherealness are
 * GM rulings. Days-long returns and a two-sided plane crossing have no timer or plane model, and
 * REVIVE is an immediate revival, so none is built. Each creature must pass its node map exactly as
 * authored, and the seven closed rule kinds are gone.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

const CREATURES: [string, CreatureAuthored, string, 'PASSIVE' | 'ACTION'][] = [
  ['Ghost', ghost, 'Etherealness', 'ACTION'],
  ['Guardian Naga', guardianNaga, 'Rejuvenation', 'PASSIVE'],
  ['Lemure', lemure, 'Hellish Rejuvenation', 'PASSIVE'],
  ['Lich', lich, 'Rejuvenation', 'PASSIVE'],
  ['Mummy Lord', mummyLord, 'Rejuvenation', 'PASSIVE'],
  ['Night Hag', nightHag, 'Etherealness', 'ACTION'],
  ['Spirit Naga', spiritNaga, 'Rejuvenation', 'PASSIVE']
]

describe('Rejuvenation and Etherealness as GM rulings (D187a)', () => {
  it.each(CREATURES)('%s authors the trait as one ruling', (_name, creature, label, kind) => {
    const effect = creature.features?.find((candidate) => candidate.label === label)?.effects?.[0]
    expect(effect?.invocation).toMatchObject({ kind, triggerCode: 'ACTIVATED' })
    const outcomes = (effect?.paths ?? []).flatMap((path) =>
      path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []
    )
    expect(outcomes).toHaveLength(1)
    expect(outcomes[0]).toMatchObject({ effectKind: 'MANUAL_ADJUDICATION', label })
  })

  it.each(CREATURES)(
    'keeps %s exactly as authored through the creature node map',
    async (_name, creature) => {
      const result = await normalizeNodeRuntimeValues(reader, {
        mapId: 'creature',
        systemId: srdSystemRecord.id,
        values: structuredClone(creature) as unknown as Record<string, unknown>
      })
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
    }
  )

  it('no longer lists the seven closed rule kinds', () => {
    for (const kind of [
      'CREATURE_GHOST_ETHEREALNESS',
      'CREATURE_GUARDIAN_NAGA_REJUVENATION',
      'CREATURE_LEMURE_HELLISH_REJUVENATION',
      'CREATURE_LICH_REJUVENATION',
      'CREATURE_MUMMY_LORD_REJUVENATION',
      'CREATURE_SPIRIT_NAGA_REJUVENATION',
      'NIGHT_HAG_ETHEREALNESS'
    ])
      expect(CLOSED_RULE_KIND).not.toHaveProperty(kind)
  })
})
