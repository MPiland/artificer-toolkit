import { describe, expect, it } from 'vitest'

import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { banishment } from '@artificer-toolkit/source-data/srd/spells/banishment.js'
import { etherealness } from '@artificer-toolkit/source-data/srd/spells/etherealness.js'
import { imprisonment } from '@artificer-toolkit/source-data/srd/spells/imprisonment.js'
import { maze } from '@artificer-toolkit/source-data/srd/spells/maze.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

async function normalizeEffects(effects: unknown) {
  const authored = { ...structuredClone(caltropsBagOf20), effects }
  const result = await normalizeNodeRuntimeValues(reader, {
    mapId: 'equipment',
    systemId: srdSystemRecord.id,
    values: structuredClone(authored) as Record<string, unknown>
  })
  return { authored, result }
}

/** SPELLS-4.T2h1: spells converted from closed rules to REMOVE_FROM_PLAY (ADR 0038 parity). */
describe('the removed-from-play effect through the effect node map (SPELLS-4.T2h1)', () => {
  it.each([
    ['Banishment', banishment],
    ['Etherealness', etherealness],
    ['Imprisonment', imprisonment],
    ['Maze', maze]
  ])('keeps the SRD %s effect exactly as authored', async (_name, spell) => {
    const { authored, result } = await normalizeEffects(spell.effects)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })

  it('keeps a homebrew variant that keeps its turn and clears keepsTurn when the kind changes', async () => {
    const effects = structuredClone(banishment.effects ?? [])
    const [path] = effects[0]?.paths ?? []
    if (path?.selectionKind !== 'FIXED') throw new Error('Banishment must author a fixed path.')
    Object.assign(path.resultBlock.outcomes[1]!, { keepsTurn: true })
    const { authored, result } = await normalizeEffects(effects)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })
})
