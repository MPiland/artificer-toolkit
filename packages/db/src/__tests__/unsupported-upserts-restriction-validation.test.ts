import { describe, expect, it } from 'vitest'
import { upsertFeature } from '../domains/features/upserts/feature.js'
import { upsertEquipment } from '../domains/subjects/upserts/equipment.js'
import { upsertFeatGrant } from '../domains/grants/upserts/feat.js'
import { upsertModifierGrant } from '../domains/grants/upserts/modifier.js'
import { upsertSenseGrant } from '../domains/grants/upserts/sense.js'
import { InMemoryDb } from './helpers/in-memory-db.js'
describe('unsupported authored effect paths fail loudly', () => {
  it('rejects feature restrictions that use invalid proficiency-grant relation target selections', async () => {
    await expect(
      upsertFeature(
        new InMemoryDb() as never,
        {
          id: 'feature-invalid-relation-target',
          label: 'Unsupported',
          description: 'Unsupported',
          order: 1,
          restrictions: {
            id: 'facet-invalid-relation-target',
            groups: [
              {
                id: 'facet-group-1',
                order: 1,
                contexts: [
                  {
                    id: 'facet-context-1',
                    order: 1,
                    subject: 'SUBCLASS',
                    authoringModeKind: 'ALL',
                    conditions: [
                      {
                        id: 'facet-condition-1',
                        order: 1,
                        kind: 'EXISTS',
                        constraint: 'INCLUDE',
                        relationCode: 'PROFICIENCY_GRANT',
                        authoringModeKind: 'SELECTED',
                        proficiencyKind: 'LUCK'
                      }
                    ]
                  }
                ]
              }
            ]
          }
        } as never,
        'system-1'
      )
    ).rejects.toThrow('invalid proficiency kind')
  })
  it('rejects feature restrictions that use DURATION in ALL mode without a minimum bound', async () => {
    await expect(
      upsertFeature(
        new InMemoryDb() as never,
        {
          id: 'feature-invalid-duration-all',
          label: 'Invalid Duration',
          description: 'Invalid',
          order: 1,
          restrictions: {
            id: 'facet-invalid-duration-all',
            groups: [
              {
                id: 'facet-group-1',
                order: 1,
                contexts: [
                  {
                    id: 'facet-context-1',
                    order: 1,
                    subject: 'FEATURE',
                    authoringModeKind: 'ALL',
                    conditions: [
                      {
                        id: 'facet-condition-1',
                        order: 1,
                        kind: 'PREDICATE',
                        constraint: 'INCLUDE',
                        predicateCode: 'DURATION',
                        authoringModeKind: 'ALL',
                        max: 10
                      }
                    ]
                  }
                ]
              }
            ]
          }
        } as never,
        'system-1'
      )
    ).rejects.toThrow('requires min for timed duration')
  })
  it('rejects feature restrictions that use RANGE in ALL mode without a unit', async () => {
    await expect(
      upsertFeature(
        new InMemoryDb() as never,
        {
          id: 'feature-invalid-range-all',
          label: 'Invalid Range',
          description: 'Invalid',
          order: 1,
          restrictions: {
            id: 'facet-invalid-range-all',
            groups: [
              {
                id: 'facet-group-1',
                order: 1,
                contexts: [
                  {
                    id: 'facet-context-1',
                    order: 1,
                    subject: 'FEATURE',
                    authoringModeKind: 'ALL',
                    conditions: [
                      {
                        id: 'facet-condition-1',
                        order: 1,
                        kind: 'PREDICATE',
                        constraint: 'INCLUDE',
                        predicateCode: 'RANGE',
                        authoringModeKind: 'ALL',
                        min: 30
                      }
                    ]
                  }
                ]
              }
            ]
          }
        } as never,
        'system-1'
      )
    ).rejects.toThrow('requires unit for DISTANCE range')
  })
  it('rejects feature restrictions that use invalid charge limit kinds', async () => {
    await expect(
      upsertFeature(
        new InMemoryDb() as never,
        {
          id: 'feature-invalid-charge-limit',
          label: 'Invalid Charge Limit',
          description: 'Invalid',
          order: 1,
          restrictions: {
            id: 'facet-invalid-charge-limit',
            groups: [
              {
                id: 'facet-group-1',
                order: 1,
                contexts: [
                  {
                    id: 'facet-context-1',
                    order: 1,
                    subject: 'FEATURE',
                    authoringModeKind: 'ALL',
                    conditions: [
                      {
                        id: 'facet-condition-1',
                        order: 1,
                        kind: 'PREDICATE',
                        constraint: 'INCLUDE',
                        predicateCode: 'CHARGE_LIMIT_KIND',
                        authoringModeKind: 'SELECTED',
                        chargeLimitKind: ['EVENTUALLY']
                      }
                    ]
                  }
                ]
              }
            ]
          }
        } as never,
        'system-1'
      )
    ).rejects.toThrow('invalid charge limit kind')
  })
  it('rejects feature restrictions that use invalid charge reset kinds', async () => {
    await expect(
      upsertFeature(
        new InMemoryDb() as never,
        {
          id: 'feature-invalid-charge-reset',
          label: 'Invalid Charge Reset',
          description: 'Invalid',
          order: 1,
          restrictions: {
            id: 'facet-invalid-charge-reset',
            groups: [
              {
                id: 'facet-group-1',
                order: 1,
                contexts: [
                  {
                    id: 'facet-context-1',
                    order: 1,
                    subject: 'FEATURE',
                    authoringModeKind: 'ALL',
                    conditions: [
                      {
                        id: 'facet-condition-1',
                        order: 1,
                        kind: 'PREDICATE',
                        constraint: 'INCLUDE',
                        predicateCode: 'CHARGE_RESET_KIND',
                        authoringModeKind: 'SELECTED',
                        chargeResetKind: ['EVENTUALLY']
                      }
                    ]
                  }
                ]
              }
            ]
          }
        } as never,
        'system-1'
      )
    ).rejects.toThrow('invalid charge reset kind')
  })
  it('rejects chosen modifier grants', async () => {
    await expect(
      upsertModifierGrant(
        {} as never,
        {
          id: 'modifier-grant-missing-count',
          grantKind: 'MODIFIER_GRANT',
          order: 1,
          selectionKind: 'CHOSEN',
          valueDomainCode: 'SAVE_DC',
          domain: {},
          modifierKind: 'ADVANTAGE',
          scope: 'GLOBAL'
        } as never,
        'system-1'
      )
    ).rejects.toThrow('unsupported selectionKind "CHOSEN"')
  })
  it('rejects granted modifier grants with count payload', async () => {
    await expect(
      upsertModifierGrant(
        {} as never,
        {
          id: 'modifier-grant-granted-count',
          grantKind: 'MODIFIER_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          count: 1,
          valueDomainCode: 'SAVE_DC',
          domain: {},
          modifierKind: 'ADVANTAGE',
          scope: 'GLOBAL'
        } as never,
        'system-1'
      )
    ).rejects.toThrow('cannot persist count for GRANTED')
  })
  it('rejects parameterized modifier grants without their domain payload', async () => {
    await expect(
      upsertModifierGrant(
        {} as never,
        {
          id: 'modifier-grant-missing-domain',
          grantKind: 'MODIFIER_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          valueDomainCode: 'SKILL_MODIFIER',
          domain: {},
          modifierKind: 'BONUS',
          scope: 'GLOBAL',
          payload: {
            valueKind: 'FIXED',
            amount: 1
          }
        } as never,
        'system-1'
      )
    ).rejects.toThrow('missing domain skillId')
  })
  it('rejects modifier grants with invalid payload ability codes', async () => {
    await expect(
      upsertModifierGrant(
        {} as never,
        {
          id: 'modifier-grant-bad-ability',
          grantKind: 'MODIFIER_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          valueDomainCode: 'ATTACK_ROLL',
          domain: { attackDomain: 'MELEE' },
          modifierKind: 'ABILITY_MODIFIER_BONUS',
          scope: 'GLOBAL',
          payload: {
            ability: 'LUCK'
          }
        } as never,
        'system-1'
      )
    ).rejects.toThrow('invalid payload ability')
  })
  it('rejects modifier grants without system ownership', async () => {
    await expect(
      upsertModifierGrant(
        {} as never,
        {
          id: 'modifier-grant-no-system',
          grantKind: 'MODIFIER_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          valueDomainCode: 'SAVE_DC',
          domain: {},
          modifierKind: 'ADVANTAGE',
          scope: 'GLOBAL'
        } as never
      )
    ).rejects.toThrow('requires a systemId')
  })
  it('rejects equipment restrictions that mix DISTANCE with other selected range kinds', async () => {
    await expect(
      upsertEquipment(
        new InMemoryDb() as never,
        {
          kind: 'EQUIPMENT',
          id: 'equipment-unsupported-restrictions',
          label: 'Unsupported',
          description: null,
          cost: { amount: 1, currencyId: 'gp' },
          weight: { amount: 1, unit: 'POUNDS' },
          rarityId: 'common',
          restrictions: {
            id: 'equipment-facet-unsupported',
            groups: [
              {
                id: 'equipment-facet-group-1',
                order: 1,
                contexts: [
                  {
                    id: 'equipment-facet-context-1',
                    order: 1,
                    subject: 'EQUIPMENT',
                    authoringModeKind: 'ALL',
                    conditions: [
                      {
                        id: 'equipment-facet-condition-1',
                        order: 1,
                        kind: 'PREDICATE',
                        constraint: 'INCLUDE',
                        predicateCode: 'RANGE',
                        authoringModeKind: 'SELECTED',
                        rangeKind: ['DISTANCE', 'TOUCH'],
                        min: 30,
                        unit: 'FEET'
                      }
                    ]
                  }
                ]
              }
            ]
          },
          userId: 'user-1',
          systemId: 'system-1',
          properties: [],
          category: 'WEAPON'
        } as never,
        'system-1'
      )
    ).rejects.toThrow('cannot mix DISTANCE')
  })
  it('rejects feat grant restrictions that mix DISTANCE with other selected range kinds', async () => {
    await expect(
      upsertFeatGrant(
        new InMemoryDb() as never,
        {
          id: 'feat-grant-unsupported',
          grantKind: 'FEAT_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'ALL',
          restrictions: {
            id: 'feat-grant-facet-unsupported',
            groups: [
              {
                id: 'feat-grant-facet-group-1',
                order: 1,
                contexts: [
                  {
                    id: 'feat-grant-facet-context-1',
                    order: 1,
                    subject: 'FEAT',
                    authoringModeKind: 'ALL',
                    conditions: [
                      {
                        id: 'feat-grant-facet-condition-1',
                        order: 1,
                        kind: 'PREDICATE',
                        constraint: 'INCLUDE',
                        predicateCode: 'RANGE',
                        authoringModeKind: 'SELECTED',
                        rangeKind: ['DISTANCE', 'TOUCH'],
                        min: 30,
                        unit: 'FEET'
                      }
                    ]
                  }
                ]
              }
            ]
          }
        } as never
      )
    ).rejects.toThrow('cannot mix DISTANCE')
  })
  it('rejects sense grant restrictions that mix DISTANCE with other selected range kinds', async () => {
    await expect(
      upsertSenseGrant(
        new InMemoryDb() as never,
        {
          id: 'sense-grant-unsupported',
          grantKind: 'SENSE_GRANT',
          order: 1,
          selectionKind: 'GRANTED',
          scalingKind: 'NONE',
          authoringModeKind: 'ALL',
          restrictions: {
            id: 'sense-grant-facet-unsupported',
            groups: [
              {
                id: 'sense-grant-facet-group-1',
                order: 1,
                contexts: [
                  {
                    id: 'sense-grant-facet-context-1',
                    order: 1,
                    subject: 'FEATURE',
                    authoringModeKind: 'ALL',
                    conditions: [
                      {
                        id: 'sense-grant-facet-condition-1',
                        order: 1,
                        kind: 'PREDICATE',
                        constraint: 'INCLUDE',
                        predicateCode: 'RANGE',
                        authoringModeKind: 'SELECTED',
                        rangeKind: ['DISTANCE', 'TOUCH'],
                        min: 30,
                        unit: 'FEET'
                      }
                    ]
                  }
                ]
              }
            ]
          }
        } as never
      )
    ).rejects.toThrow('cannot mix DISTANCE')
  })
})
