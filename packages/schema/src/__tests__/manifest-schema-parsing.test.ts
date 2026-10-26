import { describe, expect, it } from 'vitest'

import { effectDtoSchema } from '../effects/effect.js'
import { spellAuthoredDtoSchema } from '../subjects/spell.js'

type ParsedEffectForAssertions = {
  invocation: {
    kind?: string
    triggerCode?: string
    savingThrow?: unknown
  }
  paths: Array<{
    pathCode?: string
    options?: Array<Record<string, unknown>>
    rows?: Array<Record<string, unknown>>
    resultBlock?: {
      outcomes?: Array<
        Record<string, unknown> & {
          bonuses?: Array<Record<string, unknown>>
        }
      >
      lifecycle?: Record<string, unknown>
    }
  }>
}

function singleResultBlock(
  id: string,
  outcome: Record<string, unknown>,
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    resultKind: 'SINGLE',
    outcomes: [outcome],
    ...extra
  }
}

function fixedPath(
  id: string,
  order: number,
  pathCode: string,
  resultBlock: Record<string, unknown>,
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    order,
    pathCode,
    groupType: 'SINGLE',
    selectionKind: 'FIXED',
    resultBlock,
    ...extra
  }
}

function exactRollTablePath(
  id: string,
  order: number,
  pathCode: string,
  rows: Record<string, unknown>[],
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    order,
    pathCode,
    groupType: 'SINGLE',
    selectionKind: 'ROLL_TABLE',
    rollTableKind: 'EXACT',
    dieConfig: '1d4',
    rows,
    ...extra
  }
}

describe('manifest schema parsing', () => {
  it('parses manifest-owned nested behaviors when they use non-manifest outcomes', () => {
    const parsed = spellAuthoredDtoSchema.parse({
      kind: 'SPELL',
      id: 'arcane-sword',
      label: 'Arcane Sword',
      description: 'You create a sword-shaped plane of force.',
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      level: 7,
      classIds: ['wizard'],
      magicSchoolId: 'evocation',
      effects: [
        {
          id: '00000000-0000-4000-8000-0000000000f1',
          order: 1,
          invocation: {
            triggerCode: 'ACTIVATED',
            activation: {
              code: 'ACTION',
              amount: 1
            },
            range: {
              id: 'arcane-sword-range',
              rangeKind: 'DISTANCE',
              amount: 60,
              unit: 'FEET'
            }
          },
          paths: [
            fixedPath(
              'arcane-sword-path',
              1,
              'ON_USE',
              singleResultBlock('arcane-sword-result', {
                id: 'arcane-sword-manifest',
                effectKind: 'MANIFEST',
                manifestKind: 'WEAPON',
                behaviors: [
                  {
                    id: '00000000-0000-4000-8000-0000000000f2',
                    order: 1,
                    invocation: {
                      triggerCode: 'RANGED_SPELL_ATTACK',
                      activation: {
                        code: 'BONUS_ACTION',
                        amount: 1
                      },
                      range: {
                        id: 'arcane-sword-attack-range',
                        rangeKind: 'DISTANCE',
                        amount: 5,
                        unit: 'FEET'
                      }
                    },
                    paths: [
                      fixedPath(
                        'arcane-sword-hit',
                        1,
                        'ON_HIT',
                        singleResultBlock('arcane-sword-hit-result', {
                          id: 'arcane-sword-damage',
                          effectKind: 'DAMAGE',
                          damageTypeId: 'force',
                          valueKind: 'DICE',
                          scalingKind: 'NONE',
                          diceConfig: '3d10'
                        })
                      )
                    ]
                  }
                ]
              })
            )
          ]
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    }) as {
      effects?: Array<{
        paths?: Array<{
          resultBlock?: {
            outcomes?: Array<{
              behaviors?: Array<{
                paths?: Array<{
                  resultBlock?: { outcomes?: Array<{ effectKind?: string }> }
                }>
              }>
            }>
          }
        }>
      }>
    }

    expect(
      parsed.effects?.[0]?.paths?.[0]?.resultBlock?.outcomes?.[0]?.behaviors?.[0]?.paths?.[0]
        ?.resultBlock?.outcomes?.[0]
    ).toMatchObject({
      effectKind: 'DAMAGE'
    })
  })

  it('rejects an incomplete cylinder in a manifest-owned nested behavior', () => {
    expect(
      effectDtoSchema.safeParse({
        id: '00000000-0000-4000-8000-0000000000f8',
        order: 1,
        invocation: {
          triggerCode: 'ACTIVATED',
          activation: { code: 'ACTION', amount: 1 },
          range: { id: 'outer-cylinder-range', rangeKind: 'SELF' }
        },
        paths: [
          fixedPath(
            'outer-cylinder-path',
            1,
            'ON_USE',
            singleResultBlock('outer-cylinder-result', {
              id: 'outer-cylinder-manifest',
              effectKind: 'MANIFEST',
              manifestKind: 'WEAPON',
              behaviors: [
                {
                  id: '00000000-0000-4000-8000-0000000000f9',
                  order: 1,
                  invocation: {
                    triggerCode: 'ACTIVATED',
                    activation: { code: 'ACTION', amount: 1 },
                    range: { id: 'nested-cylinder-range', rangeKind: 'SELF' },
                    shape: {
                      id: 'nested-cylinder-shape',
                      shapeKind: 'CYLINDER',
                      radius: { amount: 5, unit: 'FEET' }
                    }
                  },
                  paths: [
                    fixedPath(
                      'nested-cylinder-path',
                      1,
                      'ON_USE',
                      singleResultBlock('nested-cylinder-result', {
                        id: 'nested-cylinder-outcome',
                        effectKind: 'CONDITION',
                        conditionId: 'nested-cylinder-condition'
                      })
                    )
                  ]
                }
              ]
            })
          )
        ]
      }).success
    ).toBe(false)
  })

  it('rejects manifest-owned nested behaviors that try to manifest again', () => {
    expect(() =>
      spellAuthoredDtoSchema.parse({
        kind: 'SPELL',
        id: 'bad-nested-manifest',
        label: 'Bad Nested Manifest',
        description: 'A recursive manifest payload.',
        castingTime: {
          unit: 'ROUND',
          amount: 1
        },
        level: 4,
        classIds: ['wizard'],
        magicSchoolId: 'conjuration',
        effects: [
          {
            id: '00000000-0000-4000-8000-0000000000f3',
            order: 1,
            invocation: {
              triggerCode: 'ACTIVATED',
              activation: {
                code: 'ACTION',
                amount: 1
              },
              range: {
                id: 'outer-range',
                rangeKind: 'DISTANCE',
                amount: 30,
                unit: 'FEET'
              }
            },
            paths: [
              fixedPath(
                'outer-path',
                1,
                'ON_USE',
                singleResultBlock('outer-result', {
                  id: 'outer-manifest',
                  effectKind: 'MANIFEST',
                  manifestKind: 'SUMMON',
                  behaviors: [
                    {
                      id: '00000000-0000-4000-8000-0000000000f4',
                      order: 1,
                      invocation: {
                        triggerCode: 'ACTIVATED',
                        activation: {
                          code: 'ACTION',
                          amount: 1
                        },
                        range: {
                          id: 'nested-range',
                          rangeKind: 'SELF'
                        }
                      },
                      paths: [
                        fixedPath(
                          'nested-path',
                          1,
                          'ON_USE',
                          singleResultBlock('nested-result', {
                            id: 'recursive-manifest',
                            effectKind: 'MANIFEST',
                            manifestKind: 'OBJECT'
                          })
                        )
                      ]
                    }
                  ]
                })
              )
            ]
          }
        ],
        userId: 'user-1',
        systemId: 'system-1'
      })
    ).toThrow()
  })

  it('strips roll-table row labels and descriptions', () => {
    const parsed = effectDtoSchema.parse({
      id: '00000000-0000-4000-8000-0000000000f5',
      order: 1,
      invocation: {
        triggerCode: 'ACTIVATED',
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'bad-roll-range',
          rangeKind: 'DISTANCE',
          amount: 30,
          unit: 'FEET'
        }
      },
      paths: [
        // One row covering the whole die: publication refuses a table with an uncovered face.
        exactRollTablePath(
          'bad-roll-path',
          1,
          'ON_USE',
          [
            {
              id: 'bad-roll-entry',
              order: 1,
              label: 'Should fail',
              description: 'Roll tables should not use entry metadata.',
              rollRange: [1, 4],
              resolutionKind: 'RESULT',
              resultBlock: singleResultBlock('bad-roll-result', {
                id: 'bad-roll-outcome',
                effectKind: 'MANUAL_ADJUDICATION',
                label: 'Rolled result',
                instructions: 'Resolve the rolled result.',
                reasonCode: 'NARRATIVE_JUDGMENT'
              })
            }
          ],
          { rollTableKind: 'RANGE' }
        )
      ]
    })

    const row = (parsed as unknown as ParsedEffectForAssertions).paths[0].rows?.[0]

    expect(row).not.toHaveProperty('label')
    expect(row).not.toHaveProperty('description')
  })

  it('strips creature manifest inline behaviors', () => {
    const parsed = effectDtoSchema.parse({
      id: '00000000-0000-4000-8000-0000000000f6',
      order: 1,
      invocation: {
        triggerCode: 'ACTIVATED',
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'bad-creature-range',
          rangeKind: 'DISTANCE',
          amount: 10,
          unit: 'FEET'
        }
      },
      paths: [
        fixedPath(
          'bad-creature-path',
          1,
          'ON_USE',
          singleResultBlock('bad-creature-result', {
            id: 'bad-creature-entry',
            effectKind: 'MANIFEST',
            manifestKind: 'CREATURE',
            forms: [
              {
                id: 'owl-form',
                order: 1,
                label: 'Owls',
                creatureId: 'giant-owl',
                maxTargets: 2
              }
            ],
            behaviors: []
          })
        )
      ]
    })

    const outcome = (parsed as unknown as ParsedEffectForAssertions).paths[0].resultBlock
      ?.outcomes?.[0]

    expect(outcome).toMatchObject({
      manifestKind: 'CREATURE',
      forms: [{ creatureId: 'giant-owl', maxTargets: 2 }]
    })
    expect(outcome).not.toHaveProperty('behaviors')
  })

  it('parses summon manifests with authored stat block data', () => {
    const parsed = effectDtoSchema.parse({
      id: '00000000-0000-4000-8000-0000000000f7',
      order: 1,
      invocation: {
        triggerCode: 'ACTIVATED',
        activation: {
          code: 'ACTION',
          amount: 1
        },
        range: {
          id: 'summon-range',
          rangeKind: 'DISTANCE',
          amount: 120,
          unit: 'FEET'
        }
      },
      paths: [
        fixedPath(
          'summon-path',
          1,
          'ON_USE',
          singleResultBlock('summon-result', {
            id: 'summon-entry',
            effectKind: 'MANIFEST',
            manifestKind: 'SUMMON',
            statBlock: {
              size: 'LARGE',
              armorClass: {
                kind: 'FIXED',
                value: 20
              },
              hitPoints: {
                kind: 'HIT_POINT_MAXIMUM'
              },
              speeds: [
                {
                  speedId: 'arcane-hand-speed',
                  amount: 60,
                  unit: 'FEET'
                }
              ],
              abilityScores: {
                STRENGTH: {
                  kind: 'FIXED',
                  value: 26
                }
              },
              damageabilityKind: 'INVULNERABLE',
              occupiesSpace: true
            }
          })
        )
      ]
    })

    expect(
      (parsed as unknown as ParsedEffectForAssertions).paths[0].resultBlock?.outcomes?.[0]
    ).toMatchObject({
      manifestKind: 'SUMMON',
      statBlock: {
        size: 'LARGE',
        armorClass: {
          kind: 'FIXED',
          value: 20
        },
        hitPoints: {
          kind: 'HIT_POINT_MAXIMUM'
        },
        speeds: [
          {
            speedId: 'arcane-hand-speed',
            amount: 60,
            unit: 'FEET'
          }
        ],
        abilityScores: {
          STRENGTH: {
            kind: 'FIXED',
            value: 26
          }
        },
        damageabilityKind: 'INVULNERABLE',
        occupiesSpace: true
      }
    })
  })
})
