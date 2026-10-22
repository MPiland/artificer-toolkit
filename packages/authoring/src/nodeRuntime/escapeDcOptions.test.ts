import { describe, expect, it } from 'vitest'

import { rugOfSmothering } from '@artificer-toolkit/source-data/srd/creatures/rug-of-smothering.js'
import {
  SRD_PASSIVE_PERCEPTION_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

/** Every escape check module the value nests, wherever it sits. */
function escapeChecks(value: unknown): { dc: unknown }[] {
  if (typeof value !== 'object' || value === null) return []
  const own = 'kind' in value && value.kind === 'ESCAPE_CHECK' && 'dc' in value ? [value] : []
  return [...own, ...Object.values(value).flatMap(escapeChecks)]
}

/** The rug's authored creature with every escape check rolling against `dc`. */
function rugWithEscapeDc(dc: unknown) {
  const creature = structuredClone(rugOfSmothering)
  const modules = escapeChecks(creature)
  expect(modules.length).toBeGreaterThan(0)
  for (const module of modules) module.dc = dc
  return creature
}

function normalize(creature: unknown) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as Record<string, unknown>
  })
}

describe('the escape check DC through the creature node map', () => {
  it('keeps a fixed DC, which an escape rolls against', async () => {
    const result = await normalize(rugWithEscapeDc({ kind: 'FIXED', value: 13 }))
    expect(result.clearedPaths).toEqual([])
  })

  it.each([
    ['a passive score', { kind: 'PASSIVE', passiveDefinitionId: SRD_PASSIVE_PERCEPTION_ID }],
    ['a concealment total', { kind: 'CONCEALMENT' }]
  ])('clears %s, which an escape never rolls against', async (_label, dc) => {
    const result = await normalize(rugWithEscapeDc(dc))
    expect(result.clearedPaths.length).toBeGreaterThan(0)
  })
})
