import { describe, expect, it } from 'vitest'

import { printCreatureSenses } from '../domains/subjects/core/creatureSenses.js'

const label = () => 'Darkvision'

describe('printCreatureSenses', () => {
  it('prints each sense with its range in the registry abbreviation and its qualifier', () => {
    expect(
      printCreatureSenses(
        [
          { senseDefinitionId: 'a', range: { id: 'r', rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' } },
          {
            senseDefinitionId: 'b',
            range: { id: 'r', rangeKind: 'DISTANCE', amount: 20, unit: 'YARDS' },
            qualifier: '(blind beyond this radius)'
          },
          { senseDefinitionId: 'c', range: { rangeKind: 'UNLIMITED' } }
        ],
        label
      )
    ).toEqual([
      'darkvision 60 ft',
      'darkvision 20 yd (blind beyond this radius)',
      'darkvision unlimited'
    ])
  })
})
