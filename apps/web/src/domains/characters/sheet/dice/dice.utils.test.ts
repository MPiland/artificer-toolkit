import { buildManualExpression, getMechanicRollTargets } from './dice.utils'

describe('character sheet dice utilities', () => {
  it('builds manual expressions and derives authoritative mechanic roll targets', () => {
    expect(
      buildManualExpression([
        { id: 'd6', count: 2, die: 6, modifier: 3 },
        { id: 'd4', count: 1, die: 4, modifier: 1 }
      ])
    ).toBe('2d6 + 3 + 1d4 + 1')

    expect(
      getMechanicRollTargets(
        [
          {
            effectId: 'effect-1',
            trigger: 'ON_USE',
            attackBonus: 5,
            attackRollMode: 'ADVANTAGE',
            outcomes: [
              {
                kind: 'DAMAGE',
                pathCode: 'damage',
                expression: '1d8 + 3',
                damageTypeId: 'slashing',
                damageTypeLabel: 'Slashing'
              },
              {
                kind: 'HEAL',
                pathCode: 'healing',
                expression: '1d4 + 2',
                temporary: false
              }
            ]
          }
        ],
        'Astral Blade'
      )
    ).toEqual([
      {
        expression: '1d20 + 5',
        rollMode: 'ADVANTAGE',
        source: { kind: 'ATTACK', label: 'Astral Blade attack' },
        text: '+5'
      },
      {
        expression: '1d8 + 3',
        source: { kind: 'DAMAGE', label: 'Astral Blade damage' },
        text: '1d8 + 3'
      },
      {
        expression: '1d4 + 2',
        source: { kind: 'HEALING', label: 'Astral Blade healing' },
        text: '1d4 + 2'
      }
    ])
  })
})
