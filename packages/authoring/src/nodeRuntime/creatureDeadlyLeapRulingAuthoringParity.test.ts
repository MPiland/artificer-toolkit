import { describe, expect, it } from 'vitest'

import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { bulette } from '@artificer-toolkit/source-data/srd/creatures/bulette.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T6k3 (D187a): the Bulette's Deadly Leap is authored from the save, damage and
 * condition options a Builder author has, with the save-ability choice, the 15-foot jump and the
 * push as a GM ruling beside them. The subject must pass its node map exactly as authored, and
 * the Deadly Leap closed rule kind is gone.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

const deadlyLeap = bulette.features?.find(({ label }) => label === 'Deadly Leap')

/** Every outcome kind on one path code of Deadly Leap. */
function outcomeKinds(pathCode: string) {
  return (deadlyLeap?.effects ?? []).flatMap((effect) =>
    effect.paths.flatMap((path) =>
      path.selectionKind === 'FIXED' && path.pathCode === pathCode
        ? path.resultBlock.outcomes.map(({ effectKind }) => effectKind)
        : []
    )
  )
}

describe('Bulette Deadly Leap as a GM ruling beside its save (D187a)', () => {
  it('authors a DC 16 Strength save over the creatures in the bulette space', () => {
    expect(deadlyLeap?.effects?.[0]?.invocation).toMatchObject({
      triggerCode: 'SAVING_THROW',
      savingThrow: { dcMethod: 'FIXED_DC', baseDc: 16 },
      targeting: { selectionKind: 'AREA_CONTENTS' }
    })
  })

  it('authors both damage types and prone on a failure and half damage on a success, each with the ruling', () => {
    expect(outcomeKinds('ON_SAVE_FAIL')).toEqual([
      'DAMAGE',
      'DAMAGE',
      'CONDITION',
      'MANUAL_ADJUDICATION'
    ])
    expect(outcomeKinds('ON_SAVE_SUCCESS')).toEqual(['DAMAGE', 'DAMAGE', 'MANUAL_ADJUDICATION'])
  })

  it('keeps the Bulette features exactly as authored through the creature node map', async () => {
    const result = await normalizeNodeRuntimeValues(reader, {
      mapId: 'creature',
      systemId: srdSystemRecord.id,
      values: structuredClone(bulette) as unknown as Record<string, unknown>
    })
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(bulette.features)
  })

  it('no longer lists the Deadly Leap closed rule kind', () => {
    expect(CLOSED_RULE_KIND).not.toHaveProperty('BULETTE_DEADLY_LEAP')
  })
})
