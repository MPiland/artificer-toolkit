import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { seaHag } from '@artificer-toolkit/source-data/srd/creatures/sea-hag.js'
import { willOWisp } from '@artificer-toolkit/source-data/srd/creatures/will-o-wisp.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33.T4i4b (D156, D187a): Consume Life (a KILL on a failed save, with a GM-ruled regain) and
 * Death Glare (a GM ruling behind its target requirements) use only the options a homebrew author
 * has, so each must pass the creature node map exactly as authored.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

describe('save-gated kill and gaze through the creature node map (SPELLS-33.T4i4b)', () => {
  it.each([
    ["the Will-o'-Wisp", willOWisp],
    ['the Sea Hag', seaHag]
  ])('keeps %s exactly as authored', async (_label, creature: CreatureAuthored) => {
    const result = await normalizeNodeRuntimeValues(reader, {
      mapId: 'creature',
      systemId: srdSystemRecord.id,
      values: structuredClone(creature) as unknown as Record<string, unknown>
    })
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
  })
})
