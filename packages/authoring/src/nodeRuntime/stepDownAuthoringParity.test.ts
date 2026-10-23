import { describe, expect, it } from 'vitest'

import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { raiseDead } from '@artificer-toolkit/source-data/srd/spells/raise-dead.js'
import { resurrection } from '@artificer-toolkit/source-data/srd/spells/resurrection.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

type Container = { paths: { resultBlock: { lifecycle?: Record<string, unknown> } }[] }

const penaltyPath = (effects: Container[]) => effects[0]!.paths[1]!.resultBlock

function withEffects(effects: unknown) {
  return { ...structuredClone(caltropsBagOf20), effects: structuredClone(effects) as Container[] }
}

const normalize = (authored: ReturnType<typeof withEffects>) =>
  normalizeNodeRuntimeValues(reader, {
    mapId: 'equipment',
    systemId: srdSystemRecord.id,
    values: structuredClone(authored) as Record<string, unknown>
  })

describe('a stepDown lifecycle through the effect node map (SPELLS-4.T2g2, ADR 0038)', () => {
  it.each([
    ['Raise Dead', raiseDead],
    ['Resurrection', resurrection]
  ])('keeps the %s return-from-death penalty exactly as authored', async (_name, spell) => {
    const authored = withEffects(spell.effects)
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })

  it('keeps a homebrew step that is not one', async () => {
    const authored = withEffects(raiseDead.effects)
    penaltyPath(authored.effects).lifecycle = { stepDown: { trigger: 'LONG_REST', step: 2 } }
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(
      penaltyPath(getValueAtPath(result.values, ['effects']) as Container[]).lifecycle
    ).toEqual({ stepDown: { trigger: 'LONG_REST', step: 2 } })
  })

  it('clears a trigger the node does not offer', async () => {
    const authored = withEffects(raiseDead.effects)
    penaltyPath(authored.effects).lifecycle = { stepDown: { trigger: 'SHORT_REST', step: 1 } }
    const result = await normalize(authored)
    expect(result.clearedPaths.length).toBeGreaterThan(0)
  })
})
