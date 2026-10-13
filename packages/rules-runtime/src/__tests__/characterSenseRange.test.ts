import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import { SRD_DARKVISION_SENSE_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { evaluateDnd5eCharacterMovementAndSenses } from '../systems/dnd5e/characterMovementAndSenses.js'

type FoldedSense = CharacterGrantFoldOutput['senses'][number]
type FoldedRange = FoldedSense['range']

const distance = (amount: number, id = `distance-${amount}`): FoldedRange => ({
  id,
  rangeKind: 'DISTANCE',
  amount,
  unit: 'FEET'
})
const unlimited: FoldedRange = { id: 'unlimited', rangeKind: 'UNLIMITED' }

const granted = (range: FoldedRange, index: number): FoldedSense => ({
  senseDefinitionId: SRD_DARKVISION_SENSE_ID,
  range,
  acceptedSenseIndex: index,
  grantId: `grant-${index}`,
  source: { kind: 'SYSTEM', systemId: 'test' }
})

function sensesFrom(
  ranges: readonly FoldedRange[],
  overrides: { sourceId: string; value: number }[] = []
) {
  return evaluateDnd5eCharacterMovementAndSenses(
    {
      senseFacts: {
        overrides: overrides.map((override) => ({
          ...override,
          senseDefinitionId: SRD_DARKVISION_SENSE_ID,
          unit: 'FEET'
        }))
      }
    },
    { senses: ranges.map(granted), modifiers: [] },
    []
  ).senses
}

describe('Character sense ranges', () => {
  it('keeps an unlimited grant unlimited beside a 120 foot grant', () => {
    expect(sensesFrom([distance(120), unlimited])).toEqual([
      { senseDefinitionId: SRD_DARKVISION_SENSE_ID, range: unlimited }
    ])
    expect(sensesFrom([unlimited, distance(120)])).toEqual([
      { senseDefinitionId: SRD_DARKVISION_SENSE_ID, range: unlimited }
    ])
  })

  it('takes the widest granted distance', () => {
    expect(sensesFrom([distance(60), distance(120), distance(30)])).toEqual([
      {
        senseDefinitionId: SRD_DARKVISION_SENSE_ID,
        range: {
          ...distance(120),
          calculation: { base: 120, effective: 120, contributions: [], override: null }
        }
      }
    ])
  })

  it('shows no sense with no grant and no override', () => {
    expect(sensesFrom([])).toEqual([])
  })

  it('lets a Sheet override set the distance outright, and be the range with no grant', () => {
    const override = { sourceId: 'manual-1', value: 90 }
    expect(sensesFrom([distance(60)], [override])[0]?.range).toMatchObject({
      id: 'manual-1',
      rangeKind: 'DISTANCE',
      amount: 90,
      unit: 'FEET'
    })
    expect(sensesFrom([], [override])[0]?.range).toMatchObject({
      id: 'manual-1',
      rangeKind: 'DISTANCE',
      amount: 90,
      unit: 'FEET'
    })
  })
})
