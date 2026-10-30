import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { nightmare } from '@artificer-toolkit/source-data/srd/creatures/nightmare.js'
import { willOWisp } from '@artificer-toolkit/source-data/srd/creatures/will-o-wisp.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T6j (ADR 0038, D156): the SRD Nightmare's Illumination and Will-o'-wisp's Variable
 * Illumination shed light through the same MANIFEST light a torch carries, authored from the core
 * options a Builder author has on a creature feature. Each must pass the creature node map exactly
 * as authored, as must a variant with other radii.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

/** The creature's light feature and its one light, found by narrowing the authored record. */
function shedLight(creature: CreatureAuthored, label: string) {
  const feature = creature.features?.find((candidate) => candidate.label === label)
  const path = feature?.effects?.[0]?.paths[0]
  const outcome = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
  if (!feature || outcome?.effectKind !== 'MANIFEST' || outcome.manifestKind !== 'OBJECT')
    throw new Error(`The creature must author its ${label} as a manifested light.`)
  return { feature, outcome }
}

describe('a creature’s light through the creature node map (ADR 0038)', () => {
  it.each([
    { creature: nightmare, label: 'Illumination', bright: 10, dimAdditional: 10 },
    { creature: willOWisp, label: 'Variable Illumination', bright: 20, dimAdditional: 20 }
  ])(
    'keeps the SRD $label exactly as authored, with no closed rule',
    async ({ creature, label, bright, dimAdditional }) => {
      const { feature, outcome } = shedLight(creature, label)
      expect(JSON.stringify(feature)).not.toContain('CLOSED_RULE')
      expect(outcome).toMatchObject({
        attachmentKind: 'SOURCE',
        light: {
          bright: { amount: bright, unit: 'FEET' },
          dimAdditional: { amount: dimAdditional, unit: 'FEET' }
        }
      })
      const result = await normalize(creature)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
    }
  )

  it('keeps a light with other radii the same way', async () => {
    const authored = structuredClone(nightmare)
    const { outcome } = shedLight(authored, 'Illumination')
    outcome.light = {
      bright: { amount: 30, unit: 'FEET' },
      dimAdditional: { amount: 15, unit: 'FEET' }
    }
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })
})
