import { describe, expect, it } from 'vitest'

import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { revivify } from '@artificer-toolkit/source-data/srd/spells/revivify.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

type Container = { paths: { resultBlock: { outcomes: Record<string, unknown>[] } }[] }

function withReviveHitPoints(hitPoints: unknown) {
  const effects = structuredClone(revivify.effects) as unknown as Container[]
  Object.assign(effects[0]!.paths[0]!.resultBlock.outcomes[0]!, { hitPoints })
  return { ...structuredClone(caltropsBagOf20), effects }
}

const normalize = (authored: ReturnType<typeof withReviveHitPoints>) =>
  normalizeNodeRuntimeValues(reader, {
    mapId: 'equipment',
    systemId: srdSystemRecord.id,
    values: structuredClone(authored) as Record<string, unknown>
  })

describe('a homebrew REVIVE outcome through the effect node map (SPELLS-4.T2g1, ADR 0038)', () => {
  it('keeps either hit-point choice exactly as authored', async () => {
    for (const hitPoints of ['ONE', 'MAXIMUM']) {
      const authored = withReviveHitPoints(hitPoints)
      const result = await normalize(authored)
      expect(result.clearedPaths, hitPoints).toEqual([])
      expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
    }
  })

  it('clears a hit-point choice the node does not offer', async () => {
    const result = await normalize(withReviveHitPoints('HALF'))
    expect(result.clearedPaths.length).toBeGreaterThan(0)
  })
})
