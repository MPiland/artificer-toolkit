import { describe, expect, it } from 'vitest'
import { createSpellGrantRepository } from '../repositories/index.js'
import { createSpellRepository } from '../repositories/index.js'
import { InMemoryDb } from './helpers/in-memory-db.js'
describe('round-trip upsert correctness', () => {
  it('rewrites spell grant attributes explicitly and clears stale attribute rows', async () => {
    const db = new InMemoryDb()
    const repository = createSpellGrantRepository(db as never)
    await repository.upsert({
      id: 'spell-grant-attributes-1',
      grantKind: 'SPELL_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      attributes: ['LIMITED_USE'],
      charges: {
        id: 'spell-grant-attributes-charge-1',
        resetKind: 'LONG_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 1
      }
    })
    await repository.upsert({
      id: 'spell-grant-attributes-1',
      grantKind: 'SPELL_GRANT',
      order: 2,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      attributes: ['CAST_AT_WILL', 'CAST_AT_LEVEL', 'SELF_ONLY'],
      castAtLevel: 3
    })
    await expect(repository.findById('spell-grant-attributes-1')).resolves.toEqual({
      id: 'spell-grant-attributes-1',
      grantKind: 'SPELL_GRANT',
      order: 2,
      castAtLevel: 3,
      attributes: ['CAST_AT_WILL', 'CAST_AT_LEVEL', 'SELF_ONLY'],
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      count: undefined,
      spellIds: undefined,
      charges: undefined,
      filters: undefined,
      restrictions: undefined
    })
    expect(db.snapshot('spell_grant_attributes')).toEqual([
      {
        spell_grant_id: 'spell-grant-attributes-1',
        attribute_code: 'CAST_AT_WILL',
        sort_order: 1
      },
      {
        spell_grant_id: 'spell-grant-attributes-1',
        attribute_code: 'CAST_AT_LEVEL',
        sort_order: 2
      },
      {
        spell_grant_id: 'spell-grant-attributes-1',
        attribute_code: 'SELF_ONLY',
        sort_order: 3
      }
    ])
    expect(db.snapshot('charges')).toEqual([])
  })
  it('rewrites spell class and attribute rows idempotently without leaving stale links behind', async () => {
    const db = new InMemoryDb()
    const repository = createSpellRepository(db as never)
    await repository.upsert(
      {
        kind: 'SPELL',
        id: 'spell-1',
        label: 'Magic Missile',
        description: 'Original spell',
        attributes: ['RITUAL'],
        castingTime: {
          unit: 'ROUND',
          amount: 1
        },
        level: 1,
        classIds: ['wizard', 'sorcerer'],
        magicSchoolId: 'evocation',
        materialDescription: 'A sliver of glass.',
        userId: 'user-1',
        systemId: 'system-1'
      },
      { contentSourceId: 'content-source-1' }
    )
    await repository.upsert(
      {
        kind: 'SPELL',
        id: 'spell-1',
        label: 'Magic Missile',
        description: 'Updated spell',
        attributes: ['CONCENTRATION', 'ADDS_TO_WEAPON_ATTACK'],
        castingTime: {
          unit: 'MINUTE',
          amount: 10
        },
        level: 2,
        classIds: ['wizard'],
        magicSchoolId: 'evocation',
        userId: 'user-1',
        systemId: 'system-1'
      },
      { contentSourceId: 'content-source-1' }
    )
    await expect(repository.findById('spell-1')).resolves.toEqual({
      kind: 'SPELL',
      id: 'spell-1',
      label: 'Magic Missile',
      description: 'Updated spell',
      status: 'DRAFT',
      attributes: ['CONCENTRATION', 'ADDS_TO_WEAPON_ATTACK'],
      castingTime: {
        unit: 'MINUTE',
        amount: 10
      },
      components: undefined,
      level: 2,
      classIds: ['wizard'],
      magicSchoolId: 'evocation',
      effects: undefined,
      materialDescription: undefined,
      userId: 'user-1',
      systemId: 'system-1'
    })
    expect(db.snapshot('spell_attributes')).toEqual([
      {
        spell_id: 'spell-1',
        attribute_code: 'CONCENTRATION',
        sort_order: 1
      },
      {
        spell_id: 'spell-1',
        attribute_code: 'ADDS_TO_WEAPON_ATTACK',
        sort_order: 2
      }
    ])
    expect(db.snapshot('spell_classes')).toEqual([
      {
        spell_id: 'spell-1',
        class_id: 'wizard'
      }
    ])
  })
  it('rewrites spell-owned effects idempotently while preserving reused effect ids', async () => {
    const db = new InMemoryDb()
    const repository = createSpellRepository(db as never)
    await repository.upsert(
      {
        kind: 'SPELL',
        id: 'spell-effect-rewrite-1',
        label: 'Thunder Burst',
        description: 'Original spell',
        castingTime: {
          unit: 'ROUND',
          amount: 1
        },
        level: 1,
        classIds: ['wizard'],
        magicSchoolId: 'evocation',
        effects: [
          {
            id: 'spell-shared-effect-1',
            order: 1,
            invocation: {
              triggerCode: 'SPELL_ATTACK',
              activation: {
                code: 'ACTION',
                amount: 1
              },
              range: {
                id: 'spell-effect-range-1',
                rangeKind: 'DISTANCE',
                amount: 60,
                unit: 'FEET'
              }
            },
            paths: [
              {
                id: 'spell-effect-PATH_CODE-1',
                order: 1,
                pathCode: 'ON_HIT',
                groupType: 'SINGLE',
                selectionKind: 'FIXED' as const,
                resultBlock: {
                  id: 'spell-effect-PATH_CODE-1',
                  resultKind: 'SINGLE' as const,
                  outcomes: [
                    {
                      id: 'spell-effect-PATH_CODE-1',
                      effectKind: 'DAMAGE',
                      damageTypeId: 'thunder',
                      valueKind: 'FIXED',
                      scalingKind: 'NONE',
                      amount: 5
                    }
                  ]
                }
              }
            ]
          }
        ],
        userId: 'user-1',
        systemId: 'system-1'
      },
      { contentSourceId: 'content-source-1' }
    )
    await repository.upsert(
      {
        kind: 'SPELL',
        id: 'spell-effect-rewrite-1',
        label: 'Thunder Burst',
        description: 'Updated spell',
        castingTime: {
          unit: 'ROUND',
          amount: 1
        },
        level: 1,
        classIds: ['wizard'],
        magicSchoolId: 'evocation',
        effects: [
          {
            id: 'spell-shared-effect-1',
            order: 2,
            invocation: {
              triggerCode: 'SPELL_ATTACK',
              activation: {
                code: 'BONUS_ACTION',
                amount: 1
              },
              range: {
                id: 'spell-effect-range-1',
                rangeKind: 'DISTANCE',
                amount: 120,
                unit: 'FEET'
              }
            },
            paths: [
              {
                id: 'spell-effect-PATH_CODE-2',
                order: 1,
                pathCode: 'ON_HIT',
                groupType: 'SINGLE',
                selectionKind: 'FIXED' as const,
                resultBlock: {
                  id: 'spell-effect-PATH_CODE-2',
                  resultKind: 'SINGLE' as const,
                  outcomes: [
                    {
                      id: 'spell-effect-PATH_CODE-2',
                      effectKind: 'CONDITION',
                      conditionId: 'deafened'
                    }
                  ]
                }
              }
            ]
          }
        ],
        userId: 'user-1',
        systemId: 'system-1'
      },
      { contentSourceId: 'content-source-1' }
    )
    await expect(repository.findById('spell-effect-rewrite-1')).resolves.toMatchObject({
      kind: 'SPELL',
      id: 'spell-effect-rewrite-1',
      label: 'Thunder Burst',
      description: 'Updated spell',
      attributes: undefined,
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      level: 1,
      classIds: ['wizard'],
      magicSchoolId: 'evocation',
      effects: [
        {
          id: 'spell-shared-effect-1',
          order: 2,
          invocation: {
            kind: 'ACTION',
            triggerCode: 'SPELL_ATTACK',
            activation: {
              code: 'BONUS_ACTION',
              amount: 1
            },
            range: {
              id: 'spell-effect-range-1',
              rangeKind: 'DISTANCE',
              amount: 120,
              unit: 'FEET'
            }
          },
          paths: [
            {
              id: 'spell-effect-PATH_CODE-2',
              order: 1,
              pathCode: 'ON_HIT',
              groupType: 'SINGLE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: 'spell-effect-PATH_CODE-2',
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: 'spell-effect-PATH_CODE-2',
                    effectKind: 'CONDITION',
                    conditionId: 'deafened'
                  }
                ]
              }
            }
          ]
        }
      ],
      materialDescription: undefined,
      userId: 'user-1',
      systemId: 'system-1'
    })
    expect(db.snapshot('spell_effects')).toEqual([
      {
        spell_id: 'spell-effect-rewrite-1',
        effect_id: 'spell-shared-effect-1',
        sort_order: 1
      }
    ])
    expect(db.snapshot('damages')).toEqual([])
    expect(db.snapshot('conditions')).toEqual([
      {
        id: 'spell-effect-PATH_CODE-2',
        condition_type_id: 'deafened'
      }
    ])
  })
})
