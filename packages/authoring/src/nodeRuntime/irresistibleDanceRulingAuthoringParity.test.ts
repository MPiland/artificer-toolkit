import { describe, expect, it } from 'vitest'

import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { irresistibleDance } from '@artificer-toolkit/source-data/srd/spells/irresistible-dance.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-4 T2m1d (D187a): Irresistible Dance ships its movement, attack and Dexterity-save
 * grants as data and the holder-action Wisdom save as a GM ruling a Builder author can write
 * with the MANUAL_ADJUDICATION option. The authored effects must pass their node map exactly as written.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

describe('Irresistible Dance holder-action save as a GM ruling (D187a)', () => {
  it('authors the grants beside the ruling on the one cast outcome path', () => {
    const outcomes = (irresistibleDance.effects ?? []).flatMap((effect) =>
      effect.paths.flatMap((path) =>
        path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []
      )
    )
    expect(outcomes.map(({ effectKind }) => effectKind)).toEqual([
      'APPLY_GRANT',
      'MANUAL_ADJUDICATION'
    ])
  })

  it('keeps the effects exactly as authored through the equipment node map', async () => {
    const authored = { ...structuredClone(caltropsBagOf20), effects: irresistibleDance.effects }
    const result = await normalizeNodeRuntimeValues(reader, {
      mapId: 'equipment',
      systemId: srdSystemRecord.id,
      values: structuredClone(authored) as Record<string, unknown>
    })
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(
      (authored as EquipmentAuthored).effects
    )
  })

  it('no longer lists the Irresistible Dance closed rule kind', () => {
    expect(CLOSED_RULE_KIND).not.toHaveProperty('IRRESISTIBLE_DANCE')
  })
})
